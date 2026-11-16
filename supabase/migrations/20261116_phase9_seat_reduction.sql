-- Phase 9: Scheduled seat reduction with staff selection
--
-- Adds:
--   1. selected_removal_ids uuid[] on pending_billing_changes
--   2. org_schedule_seat_reduction  — org_admin callable; records who to remove
--   3. admin_apply_seat_reduction   — TSE admin; executes removals + billing at renewal
--   4. org_get_pending_seat_reduction — readable by org_admin or TSE admin
--   5. admin_get_org_staff          — TSE admin view of all active staff for an org

-- ─── 1. Schema ────────────────────────────────────────────────────────────────

ALTER TABLE pending_billing_changes
  ADD COLUMN IF NOT EXISTS selected_removal_ids uuid[] DEFAULT NULL;

-- ─── 2. org_schedule_seat_reduction ──────────────────────────────────────────
-- Called by an org_admin to schedule a seat reduction at next renewal.
-- p_org_id              the organization
-- p_new_total_seats     desired total seat count after reduction (must be < current total; must be >= included seats from tier)
-- p_removal_ids         org_member ids to remove; count must equal current_total - p_new_total_seats
--
-- Replaces any existing pending seat_reduction for the org.

CREATE OR REPLACE FUNCTION org_schedule_seat_reduction(
  p_org_id          uuid,
  p_new_total_seats integer,
  p_removal_ids     uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cap           record;
  v_org           record;
  v_loc           record;
  v_reduction     integer;
  v_mid           uuid;
  v_renewal       date;
  v_pbc_id        uuid;
  v_poc_members   uuid[];
BEGIN
  -- Auth: org_admin for this org OR TSE admin
  IF NOT EXISTS (
    SELECT 1 FROM org_members
    WHERE org_id = p_org_id AND user_id = auth.uid()
      AND role IN ('org_admin') AND status = 'active'
  ) AND NOT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only org admins can schedule seat reductions';
  END IF;

  -- Load org and its primary location
  SELECT o.*, l.id AS loc_id, l.extra_staff_seats,
         COALESCE(l.enrolled_at::date + interval '1 year', CURRENT_DATE + interval '1 year') AS approx_renewal
  INTO v_org
  FROM organizations o
  JOIN locations l ON l.org_id = o.id AND l.is_active = true
  WHERE o.id = p_org_id
  ORDER BY l.created_at
  LIMIT 1;

  IF NOT FOUND THEN RAISE EXCEPTION 'Organization or active location not found'; END IF;

  -- Get seat capacity for the primary location
  SELECT * INTO v_cap FROM get_seat_capacity(v_org.loc_id);

  -- Roll renewal date forward past today
  v_renewal := v_org.approx_renewal::date;
  WHILE v_renewal <= CURRENT_DATE LOOP
    v_renewal := (v_renewal + interval '1 year')::date;
  END LOOP;

  v_reduction := v_cap.total_seats - p_new_total_seats;

  IF v_reduction <= 0 THEN
    RAISE EXCEPTION 'New total (%) must be less than current total (%)', p_new_total_seats, v_cap.total_seats;
  END IF;

  IF p_new_total_seats < v_cap.included_seats THEN
    RAISE EXCEPTION 'Cannot reduce below tier-included seats (%)', v_cap.included_seats;
  END IF;

  IF array_length(p_removal_ids, 1) IS DISTINCT FROM v_reduction THEN
    RAISE EXCEPTION 'Must select exactly % member(s) for removal (reducing % → %)',
      v_reduction, v_cap.total_seats, p_new_total_seats;
  END IF;

  -- Validate every selected member_id belongs to this org and is active
  FOR v_mid IN SELECT unnest(p_removal_ids) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM org_members
      WHERE id = v_mid AND org_id = p_org_id AND status = 'active'
    ) THEN
      RAISE EXCEPTION 'Member % is not an active member of this organization', v_mid;
    END IF;
  END LOOP;

  -- Identify if any selected member is a location POC (flag in return value only;
  -- actual POC workflow fires when org_remove_staff is called at apply time)
  SELECT array_agg(om.id)
  INTO v_poc_members
  FROM org_members om
  JOIN contacts c ON c.user_id = om.user_id AND c.location_id = om.location_id
  WHERE om.id = ANY(p_removal_ids)
    AND c.is_primary_contact = true;

  -- Upsert pending_billing_changes (one row per org, replace any existing)
  INSERT INTO pending_billing_changes (
    org_id, change_type, new_extra_staff_seats, selected_removal_ids, change_notes, created_by
  )
  SELECT
    p_org_id,
    'seat_reduction',
    COALESCE(v_org.extra_staff_seats, 0) - v_reduction,
    p_removal_ids,
    'Reduce from ' || v_cap.total_seats || ' to ' || p_new_total_seats
      || ' seats effective ' || v_renewal,
    auth.uid()
  ON CONFLICT (org_id) DO UPDATE
    SET change_type           = 'seat_reduction',
        new_extra_staff_seats = EXCLUDED.new_extra_staff_seats,
        selected_removal_ids  = EXCLUDED.selected_removal_ids,
        change_notes          = EXCLUDED.change_notes,
        created_by            = EXCLUDED.created_by,
        created_at            = now()
  RETURNING id INTO v_pbc_id;

  RETURN jsonb_build_object(
    'pending_id',          v_pbc_id,
    'reduction',           v_reduction,
    'new_total_seats',     p_new_total_seats,
    'effective_date',      v_renewal,
    'poc_flagged_members', COALESCE(v_poc_members, ARRAY[]::uuid[])
  );
END;
$$;

GRANT EXECUTE ON FUNCTION org_schedule_seat_reduction TO authenticated;

-- ─── 3. admin_apply_seat_reduction ───────────────────────────────────────────
-- TSE admin: execute the scheduled reduction at renewal time.
-- Calls org_remove_staff for each selected member (fires POC trigger automatically),
-- then reduces extra_staff_seats and deletes the pending row.

CREATE OR REPLACE FUNCTION admin_apply_seat_reduction(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_pbc     record;
  v_mid     uuid;
  v_removed integer := 0;
  v_loc     record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT * INTO v_pbc FROM pending_billing_changes
  WHERE org_id = p_org_id AND change_type = 'seat_reduction';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No pending seat reduction found for this organization';
  END IF;

  IF v_pbc.selected_removal_ids IS NULL OR array_length(v_pbc.selected_removal_ids, 1) = 0 THEN
    RAISE EXCEPTION 'Pending reduction has no selected members — was it created with the new workflow?';
  END IF;

  -- Remove each selected member (trigger fires POC check automatically)
  FOR v_mid IN SELECT unnest(v_pbc.selected_removal_ids) LOOP
    -- Only remove if still active (guard against manual changes between scheduling and apply)
    IF EXISTS (SELECT 1 FROM org_members WHERE id = v_mid AND status = 'active') THEN
      PERFORM org_remove_staff(v_mid, 'Scheduled seat reduction applied at renewal');
      v_removed := v_removed + 1;
    END IF;
  END LOOP;

  -- Update extra_staff_seats on the primary active location
  SELECT id INTO v_loc FROM locations
  WHERE org_id = p_org_id AND is_active = true
  ORDER BY created_at LIMIT 1;

  IF FOUND THEN
    UPDATE locations
    SET extra_staff_seats = GREATEST(0, COALESCE(v_pbc.new_extra_staff_seats, 0))
    WHERE id = v_loc.id;
  END IF;

  -- Clear the pending change
  DELETE FROM pending_billing_changes WHERE id = v_pbc.id;

  RETURN jsonb_build_object(
    'members_removed', v_removed,
    'new_extra_seats', COALESCE(v_pbc.new_extra_staff_seats, 0),
    'applied_at',      now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION admin_apply_seat_reduction TO authenticated;

-- ─── 4. org_get_pending_seat_reduction ───────────────────────────────────────
-- Returns the scheduled reduction details including selected member names.
-- Readable by the org's own org_admin or TSE admin.

CREATE OR REPLACE FUNCTION org_get_pending_seat_reduction(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_pbc   record;
  v_cap   record;
  v_loc   record;
  v_renewal date;
  v_members jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM org_members
    WHERE org_id = p_org_id AND user_id = auth.uid()
      AND role IN ('org_admin') AND status = 'active'
  ) AND NOT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT * INTO v_pbc FROM pending_billing_changes
  WHERE org_id = p_org_id AND change_type = 'seat_reduction';

  IF NOT FOUND THEN RETURN NULL; END IF;

  -- Get primary location for seat capacity + renewal date
  SELECT l.id, l.enrolled_at INTO v_loc
  FROM locations l
  WHERE l.org_id = p_org_id AND l.is_active = true
  ORDER BY l.created_at LIMIT 1;

  IF FOUND THEN
    SELECT * INTO v_cap FROM get_seat_capacity(v_loc.id);
    v_renewal := COALESCE(v_loc.enrolled_at::date + interval '1 year', CURRENT_DATE + interval '1 year')::date;
    WHILE v_renewal <= CURRENT_DATE LOOP
      v_renewal := (v_renewal + interval '1 year')::date;
    END LOOP;
  END IF;

  -- Build member details for selected removals
  SELECT jsonb_agg(jsonb_build_object(
    'member_id',    om.id,
    'user_id',      om.user_id,
    'display_name', u.raw_user_meta_data->>'full_name',
    'email',        u.email,
    'role',         om.role,
    'location_id',  om.location_id,
    'is_poc',       EXISTS (
      SELECT 1 FROM contacts c
      WHERE c.user_id = om.user_id AND c.location_id = om.location_id
        AND c.is_primary_contact = true
    )
  ))
  INTO v_members
  FROM org_members om
  JOIN auth.users u ON u.id = om.user_id
  WHERE om.id = ANY(v_pbc.selected_removal_ids);

  RETURN jsonb_build_object(
    'pending_id',          v_pbc.id,
    'current_total_seats', v_cap.total_seats,
    'new_total_seats',     COALESCE(v_cap.included_seats, 0) + COALESCE(v_pbc.new_extra_staff_seats, 0),
    'reduction',           array_length(v_pbc.selected_removal_ids, 1),
    'effective_date',      v_renewal,
    'change_notes',        v_pbc.change_notes,
    'created_at',          v_pbc.created_at,
    'selected_members',    COALESCE(v_members, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION org_get_pending_seat_reduction TO authenticated;

-- ─── 5. admin_get_org_staff ───────────────────────────────────────────────────
-- TSE admin view: returns all active staff members for an org with POC status.

CREATE OR REPLACE FUNCTION admin_get_org_staff(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_members jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'member_id',    om.id,
    'user_id',      om.user_id,
    'display_name', u.raw_user_meta_data->>'full_name',
    'email',        u.email,
    'role',         om.role,
    'location_id',  om.location_id,
    'location_name', l.name,
    'joined_at',    om.joined_at,
    'is_poc',       EXISTS (
      SELECT 1 FROM contacts c
      WHERE c.user_id = om.user_id AND c.location_id = om.location_id
        AND c.is_primary_contact = true
    )
  ) ORDER BY om.joined_at)
  INTO v_members
  FROM org_members om
  JOIN auth.users u ON u.id = om.user_id
  LEFT JOIN locations l ON l.id = om.location_id
  WHERE om.org_id = p_org_id AND om.status = 'active';

  RETURN COALESCE(v_members, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_get_org_staff TO authenticated;

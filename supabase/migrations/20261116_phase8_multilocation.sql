-- Phase 8: Multi-location staff support
-- 1. Fix org_members role constraint to allow 'org_admin' and 'staff'
-- 2. Change unique constraint from (org_id, user_id) to (org_id, location_id, user_id)
-- 3. Update org_invite_staff: FOR UPDATE lock + raise on duplicate (not cancel)
-- 4. Update accept_staff_invitation: per-location duplicate check (allow same user at different location)
-- 5. Update check_staff_gate: handles multi-location (already correct — checks any active membership)
-- 6. Add org_assign_existing_staff RPC
-- 7. Update org_get_staff: returns all assignments per user (grouped by location)

-- ─── 1. Fix role constraint ───────────────────────────────────────────────────
ALTER TABLE org_members DROP CONSTRAINT IF EXISTS org_members_role_check;
ALTER TABLE org_members ADD CONSTRAINT org_members_role_check
  CHECK (role IN ('org_admin', 'staff'));

-- ─── 2. Multi-location unique constraint ─────────────────────────────────────
ALTER TABLE org_members DROP CONSTRAINT IF EXISTS org_members_org_id_user_id_key;
ALTER TABLE org_members ADD CONSTRAINT org_members_unique_per_location
  UNIQUE (org_id, location_id, user_id)
  DEFERRABLE INITIALLY DEFERRED;

-- ─── 3. org_invite_staff: serialization lock + duplicate-not-cancel ───────────
CREATE OR REPLACE FUNCTION org_invite_staff(
  p_org_id uuid, p_location_id uuid, p_email text,
  p_role text DEFAULT 'staff', p_full_name text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cap record; v_token uuid;
BEGIN
  -- Auth check: org owner or org_admin member
  IF NOT EXISTS (
    SELECT 1 FROM organizations WHERE id = p_org_id AND user_id = auth.uid()
    UNION ALL
    SELECT 1 FROM org_members WHERE org_id = p_org_id AND user_id = auth.uid()
      AND role = 'org_admin' AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Only org admins can invite staff';
  END IF;

  -- Validate role
  IF p_role NOT IN ('staff', 'org_admin') THEN
    RAISE EXCEPTION 'Invalid role: must be staff or org_admin';
  END IF;

  -- Reject duplicate pending invitation at this location
  IF EXISTS (
    SELECT 1 FROM staff_invitations
    WHERE org_id = p_org_id AND location_id = p_location_id
      AND email = lower(p_email) AND status = 'pending'
      AND expires_at > now()
  ) THEN
    RAISE EXCEPTION 'A pending invitation already exists for % at this location. Resend or wait for it to expire.', p_email;
  END IF;

  -- Cancel expired invitations for this email at this location (cleanup)
  UPDATE staff_invitations SET status = 'cancelled'
  WHERE org_id = p_org_id AND location_id = p_location_id
    AND email = lower(p_email) AND status = 'pending' AND expires_at <= now();

  -- Serialize capacity check: lock the location row
  PERFORM 1 FROM locations WHERE id = p_location_id FOR UPDATE;

  -- Seat capacity check
  SELECT * INTO v_cap FROM get_seat_capacity(p_location_id);
  IF v_cap.seats_available <= 0 THEN
    RAISE EXCEPTION 'Seat limit reached: % of % seats in use. Purchase additional seats to invite more staff.',
      v_cap.seats_used, v_cap.total_seats;
  END IF;

  -- Create invitation
  INSERT INTO staff_invitations (org_id, location_id, invited_by, email, full_name, role)
  VALUES (p_org_id, p_location_id, auth.uid(), lower(p_email), p_full_name, p_role)
  RETURNING token INTO v_token;

  RETURN v_token;
END;
$$;

-- ─── 4. accept_staff_invitation: per-location duplicate check ─────────────────
CREATE OR REPLACE FUNCTION accept_staff_invitation(p_token uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_inv    record;
  v_cap    record;
  v_mem_id uuid;
BEGIN
  -- Row-level lock to serialise concurrent acceptances
  SELECT * INTO v_inv FROM staff_invitations
  WHERE token = p_token AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found or already used';
  END IF;

  IF v_inv.expires_at < now() THEN
    UPDATE staff_invitations SET status = 'expired' WHERE id = v_inv.id;
    RAISE EXCEPTION 'Invitation has expired';
  END IF;

  -- Email must match authenticated user
  IF lower(auth.email()) != lower(v_inv.email) THEN
    RAISE EXCEPTION 'This invitation was sent to %. Sign in with that email address.', v_inv.email;
  END IF;

  -- Per-location duplicate check (same user, same org, same location)
  -- Allow: same user at a different location in the same org
  IF v_inv.location_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM org_members
    WHERE org_id = v_inv.org_id AND location_id = v_inv.location_id
      AND user_id = auth.uid() AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'You already have an active membership at this location';
  END IF;

  -- Recheck seat capacity
  IF v_inv.location_id IS NOT NULL THEN
    PERFORM 1 FROM locations WHERE id = v_inv.location_id FOR UPDATE;
    SELECT * INTO v_cap FROM get_seat_capacity(v_inv.location_id);
    IF v_cap.seats_available < 0 THEN
      RAISE EXCEPTION 'No seats available for this location';
    END IF;
  END IF;

  -- Create org_member row
  INSERT INTO org_members (org_id, user_id, role, location_id, invitation_id, joined_at, status)
  VALUES (v_inv.org_id, auth.uid(), v_inv.role, v_inv.location_id, v_inv.id, now(), 'active')
  RETURNING id INTO v_mem_id;

  -- Mark invitation accepted
  UPDATE staff_invitations
  SET status = 'accepted', accepted_at = now(), accepted_by = auth.uid()
  WHERE id = v_inv.id;

  RETURN jsonb_build_object(
    'member_id',   v_mem_id,
    'org_id',      v_inv.org_id,
    'role',        v_inv.role,
    'location_id', v_inv.location_id
  );
END;
$$;

-- ─── 5. check_staff_gate: handles multi-location (any active membership) ──────
-- Already correct per existing definition — no change needed.
-- The function checks for ANY active org_members row, regardless of location.

-- ─── 6. org_assign_existing_staff: assign user to another location ────────────
CREATE OR REPLACE FUNCTION org_assign_existing_staff(
  p_org_id uuid, p_location_id uuid, p_user_id uuid, p_role text DEFAULT 'staff'
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cap record; v_member_id uuid;
BEGIN
  -- Auth check
  IF NOT EXISTS (
    SELECT 1 FROM organizations WHERE id = p_org_id AND user_id = auth.uid()
    UNION ALL
    SELECT 1 FROM org_members WHERE org_id = p_org_id AND user_id = auth.uid()
      AND role = 'org_admin' AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Only org admins can assign staff';
  END IF;

  -- Target user must have an existing active membership in this org
  IF NOT EXISTS (
    SELECT 1 FROM org_members WHERE org_id = p_org_id AND user_id = p_user_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'User is not an active member of this organization';
  END IF;

  -- Validate role
  IF p_role NOT IN ('staff', 'org_admin') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  -- Lock and check capacity
  PERFORM 1 FROM locations WHERE id = p_location_id FOR UPDATE;
  SELECT * INTO v_cap FROM get_seat_capacity(p_location_id);
  IF v_cap.seats_available <= 0 THEN
    RAISE EXCEPTION 'No seats available at this location';
  END IF;

  INSERT INTO org_members(org_id, location_id, user_id, role, status, joined_at)
  VALUES (p_org_id, p_location_id, p_user_id, p_role, 'active', now())
  RETURNING id INTO v_member_id;

  RETURN v_member_id;
END;
$$;

-- ─── 7. org_get_staff: returns all assignments per user ───────────────────────
CREATE OR REPLACE FUNCTION org_get_staff(p_org_id uuid)
RETURNS TABLE(
  member_id uuid, user_id uuid, email text, full_name text,
  role text, status text, location_id uuid, location_name text,
  joined_at timestamptz, orientation_done boolean, roe_done boolean, can_use_tools boolean
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM organizations WHERE id = p_org_id AND user_id = auth.uid()
    UNION ALL
    SELECT 1 FROM org_members WHERE org_id = p_org_id AND user_id = auth.uid()
      AND role = 'org_admin' AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT
    om.id,
    om.user_id,
    au.email::text,
    COALESCE(au.raw_user_meta_data->>'full_name', au.email)::text,
    om.role,
    om.status,
    om.location_id,
    l.name::text,
    om.joined_at,
    EXISTS(SELECT 1 FROM orientation_completions oc WHERE oc.user_id = om.user_id AND oc.org_id = p_org_id),
    EXISTS(SELECT 1 FROM roe_acknowledgments ra WHERE ra.user_id = om.user_id AND ra.org_id = p_org_id),
    (
      EXISTS(SELECT 1 FROM organizations o WHERE o.id = p_org_id AND o.user_id = om.user_id)
      OR (
        EXISTS(SELECT 1 FROM orientation_completions oc WHERE oc.user_id = om.user_id AND oc.org_id = p_org_id)
        AND EXISTS(SELECT 1 FROM roe_acknowledgments ra WHERE ra.user_id = om.user_id AND ra.org_id = p_org_id)
      )
    )
  FROM org_members om
  JOIN auth.users au ON au.id = om.user_id
  LEFT JOIN locations l ON l.id = om.location_id
  WHERE om.org_id = p_org_id
  ORDER BY om.status, au.email;
END;
$$;

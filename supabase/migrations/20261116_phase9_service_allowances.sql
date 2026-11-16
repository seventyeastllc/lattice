-- Phase 9: Service allowance types with CEIL proration
--
-- Changes:
--   1. Add per-type annual allowance columns to billing_config
--      (request_reviews, curated_intros, facilitated_sessions)
--   2. admin_enroll_location_service_allowances
--      — creates or updates all three allowance rows for a location using CEIL
--      — idempotent: ON CONFLICT increments only the gap to the configured amount
--      — called by admin_enroll_location automatically
--   3. admin_grant_upgrade_allowances
--      — mid-year tier upgrade: adds CEIL-prorated incremental entitlement
--      — preserves already-granted or used amounts; retry-safe
--   4. admin_enroll_location updated to call #2 automatically

-- ─── 1. Schema: add allowance columns to billing_config ──────────────────────

ALTER TABLE billing_config
  ADD COLUMN IF NOT EXISTS annual_request_reviews      integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS annual_curated_intros       integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS annual_facilitated_sessions integer NOT NULL DEFAULT 0;

-- Placeholder values — TSE admin updates via Admin → Billing Config.
-- [TEST] These are provisional; final values are a founder-supplied dependency.
UPDATE billing_config SET
  annual_request_reviews      = 12,
  annual_curated_intros       = 6,
  annual_facilitated_sessions = 4
WHERE tier = 'collaborator';

UPDATE billing_config SET
  annual_request_reviews      = 24,
  annual_curated_intros       = 12,
  annual_facilitated_sessions = 8
WHERE tier = 'strategic';

-- anchor: custom negotiated — stays 0 until admin sets it

-- ─── 2. admin_enroll_location_service_allowances ─────────────────────────────
-- Creates (or top-ups) all three allowance rows for one location.
-- Prorates annual amounts by days remaining to org renewal, with CEIL rounding.
-- Idempotent: safe to retry; never reduces an existing amount.
--
-- Called automatically by admin_enroll_location, and directly when correcting
-- a location that was enrolled before this migration.

CREATE OR REPLACE FUNCTION admin_enroll_location_service_allowances(
  p_location_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_loc       record;
  v_org       record;
  v_bc        record;
  v_year_end  date;
  v_today     date := CURRENT_DATE;
  v_days_left integer;
  v_year_days integer := 365;
  v_year_num  integer;
  v_result    jsonb := '[]'::jsonb;
  r           record;
  v_annual    integer;
  v_prorated  integer;
  v_existing  record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT l.*, l.org_id AS oid FROM locations l WHERE l.id = p_location_id INTO v_loc;
  IF NOT FOUND THEN RAISE EXCEPTION 'Location not found'; END IF;

  SELECT o.tier, o.renewal_date INTO v_org FROM organizations o WHERE o.id = v_loc.org_id;

  SELECT * INTO v_bc FROM billing_config WHERE tier = v_org.tier;
  IF NOT FOUND THEN RAISE EXCEPTION 'No billing_config for tier %', v_org.tier; END IF;

  -- Determine renewal date (advance past today if needed)
  v_year_end := COALESCE(
    (SELECT coverage_end FROM billing_records
     WHERE org_id = v_loc.org_id ORDER BY coverage_end DESC LIMIT 1),
    v_org.renewal_date,
    (v_today + interval '1 year')::date
  );
  WHILE v_year_end <= v_today LOOP
    v_year_end := (v_year_end + interval '1 year')::date;
  END LOOP;

  v_days_left := GREATEST(1, (v_year_end - v_today)::integer);

  -- Determine membership year number (use max existing year + 1 if none)
  SELECT COALESCE(MAX(sa.membership_year), 0) + 1
  INTO v_year_num
  FROM service_allowances sa
  WHERE sa.location_id = p_location_id
    AND sa.allowance_type IN ('request_reviews', 'curated_intros', 'facilitated_sessions')
    AND sa.expired_at IS NULL;
  -- If rows already exist for current year, use that year number
  IF EXISTS (
    SELECT 1 FROM service_allowances
    WHERE location_id = p_location_id
      AND allowance_type = 'request_reviews'
      AND year_end = v_year_end
  ) THEN
    SELECT membership_year INTO v_year_num FROM service_allowances
    WHERE location_id = p_location_id AND allowance_type = 'request_reviews' AND year_end = v_year_end
    LIMIT 1;
  END IF;

  -- Process each of the three allowance types
  FOR r IN SELECT unnest(ARRAY['request_reviews','curated_intros','facilitated_sessions']) AS atype,
                  unnest(ARRAY[v_bc.annual_request_reviews, v_bc.annual_curated_intros, v_bc.annual_facilitated_sessions]) AS annual_full
  LOOP
    v_annual   := r.annual_full;
    -- CEIL proration: 0 stays 0
    IF v_annual > 0 THEN
      v_prorated := CEIL(v_annual::numeric * v_days_left / v_year_days)::integer;
    ELSE
      v_prorated := 0;
    END IF;

    -- Check existing row
    SELECT * INTO v_existing
    FROM service_allowances
    WHERE location_id = p_location_id
      AND allowance_type = r.atype
      AND year_end = v_year_end;

    IF NOT FOUND THEN
      -- Insert new row
      INSERT INTO service_allowances (
        location_id, org_id, membership_year, allowance_type,
        annual_amount, used_amount, year_start, year_end
      ) VALUES (
        p_location_id, v_loc.org_id, v_year_num, r.atype,
        v_prorated, 0, v_today, v_year_end
      );
    ELSIF v_existing.annual_amount < v_prorated THEN
      -- Top up only — never reduce; never go below what's already used
      UPDATE service_allowances
      SET annual_amount = GREATEST(v_existing.annual_amount, v_prorated)
      WHERE id = v_existing.id;
    END IF;
    -- If existing.annual_amount >= v_prorated: already at or above target, no change needed

    v_result := v_result || jsonb_build_array(jsonb_build_object(
      'allowance_type', r.atype,
      'prorated_amount', v_prorated,
      'days_remaining', v_days_left,
      'year_end', v_year_end
    ));
  END LOOP;

  RETURN jsonb_build_object('location_id', p_location_id, 'allowances', v_result);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_enroll_location_service_allowances TO authenticated;

-- ─── 3. admin_grant_upgrade_allowances ───────────────────────────────────────
-- Mid-year tier upgrade: adds only the incremental CEIL-prorated entitlement
-- to current-year allowance rows across all active enrolled locations in an org.
-- Preserves already-granted or used amounts. Retry-safe.
--
-- p_old_tier: the tier before the upgrade
-- p_new_tier: the tier after the upgrade (must have higher allowances)

CREATE OR REPLACE FUNCTION admin_grant_upgrade_allowances(
  p_org_id   uuid,
  p_old_tier text,
  p_new_tier text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_old_bc    record;
  v_new_bc    record;
  v_today     date := CURRENT_DATE;
  v_year_end  date;
  v_days_left integer;
  v_loc       record;
  r           record;
  v_delta     integer;
  v_prorated  integer;
  v_existing  record;
  v_locations_updated integer := 0;
  v_result    jsonb := '[]'::jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT * INTO v_old_bc FROM billing_config WHERE tier = p_old_tier;
  IF NOT FOUND THEN RAISE EXCEPTION 'No billing_config for old tier %', p_old_tier; END IF;

  SELECT * INTO v_new_bc FROM billing_config WHERE tier = p_new_tier;
  IF NOT FOUND THEN RAISE EXCEPTION 'No billing_config for new tier %', p_new_tier; END IF;

  -- Determine org renewal date
  v_year_end := COALESCE(
    (SELECT coverage_end FROM billing_records
     WHERE org_id = p_org_id ORDER BY coverage_end DESC LIMIT 1),
    (SELECT renewal_date FROM organizations WHERE id = p_org_id),
    (v_today + interval '1 year')::date
  );
  WHILE v_year_end <= v_today LOOP
    v_year_end := (v_year_end + interval '1 year')::date;
  END LOOP;

  v_days_left := GREATEST(1, (v_year_end - v_today)::integer);

  FOR v_loc IN
    SELECT l.id FROM locations l
    WHERE l.org_id = p_org_id AND l.is_active = true AND l.enrollment_date IS NOT NULL
  LOOP
    FOR r IN SELECT unnest(ARRAY['request_reviews','curated_intros','facilitated_sessions']) AS atype,
                    unnest(ARRAY[
                      v_new_bc.annual_request_reviews      - v_old_bc.annual_request_reviews,
                      v_new_bc.annual_curated_intros       - v_old_bc.annual_curated_intros,
                      v_new_bc.annual_facilitated_sessions - v_old_bc.annual_facilitated_sessions
                    ]) AS annual_delta
    LOOP
      v_delta := r.annual_delta;
      IF v_delta <= 0 THEN CONTINUE; END IF;

      -- CEIL prorate the incremental entitlement
      v_prorated := CEIL(v_delta::numeric * v_days_left / 365.0)::integer;

      SELECT * INTO v_existing
      FROM service_allowances
      WHERE location_id = v_loc.id
        AND allowance_type = r.atype
        AND year_end = v_year_end
        AND expired_at IS NULL;

      IF NOT FOUND THEN
        -- No row yet — create one for the incremental amount
        INSERT INTO service_allowances (
          location_id, org_id, membership_year, allowance_type,
          annual_amount, used_amount, year_start, year_end
        )
        SELECT v_loc.id, p_org_id,
               COALESCE((SELECT MAX(membership_year) + 1 FROM service_allowances
                         WHERE location_id = v_loc.id AND allowance_type = r.atype), 1),
               r.atype, v_prorated, 0, v_today, v_year_end;
      ELSE
        -- Upgrade top-up: add incremental amount without reducing used count
        -- The new target is existing + incremental. We only add; never subtract.
        UPDATE service_allowances
        SET annual_amount = annual_amount + v_prorated
        WHERE id = v_existing.id;
      END IF;

      v_result := v_result || jsonb_build_array(jsonb_build_object(
        'location_id', v_loc.id,
        'allowance_type', r.atype,
        'incremental_prorated', v_prorated,
        'days_remaining', v_days_left
      ));
    END LOOP;
    v_locations_updated := v_locations_updated + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'org_id', p_org_id,
    'old_tier', p_old_tier,
    'new_tier', p_new_tier,
    'locations_updated', v_locations_updated,
    'grants', v_result
  );
END;
$$;

GRANT EXECUTE ON FUNCTION admin_grant_upgrade_allowances TO authenticated;

-- ─── 4. Update admin_enroll_location to call service allowance creation ───────
-- Drop and recreate so it auto-creates the three typed allowances on enrollment.

CREATE OR REPLACE FUNCTION admin_enroll_location(
  p_location_id    uuid,
  p_annual_hours   numeric DEFAULT 0,
  p_allowance_type text DEFAULT 'hours',
  p_enrolled_at    timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_loc       record;
  v_org       record;
  v_sequence  integer;
  v_year_end  date;
  v_price     record;
  v_sa_result jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_loc FROM locations WHERE id = p_location_id;
  SELECT * INTO v_org FROM organizations WHERE id = v_loc.org_id;

  -- Assign next sequence number
  SELECT COALESCE(MAX(l.location_sequence), 0) + 1
  INTO v_sequence
  FROM locations l
  WHERE l.org_id = v_loc.org_id AND l.enrollment_date IS NOT NULL;

  v_year_end := COALESCE(v_org.renewal_date, (p_enrolled_at::date + interval '1 year')::date);

  UPDATE locations
  SET enrollment_date    = p_enrolled_at,
      enrolled_at        = p_enrolled_at,
      location_sequence  = v_sequence
  WHERE id = p_location_id;

  -- Legacy generic allowance (hours/credits/sessions) if caller supplies one
  IF p_annual_hours > 0 THEN
    INSERT INTO service_allowances (
      location_id, org_id, membership_year, allowance_type,
      annual_amount, used_amount, year_start, year_end
    ) VALUES (
      p_location_id, v_loc.org_id, 1, p_allowance_type,
      p_annual_hours, 0, p_enrolled_at::date, v_year_end
    )
    ON CONFLICT (location_id, allowance_type, membership_year) DO NOTHING;
  END IF;

  -- Auto-create the three typed service allowances with CEIL proration
  SELECT admin_enroll_location_service_allowances(p_location_id) INTO v_sa_result;

  -- Calculate prorated price for reference
  SELECT * INTO v_price FROM calculate_location_price(v_loc.org_id, v_sequence, 'prorated');

  RETURN jsonb_build_object(
    'location_id',       p_location_id,
    'location_sequence', v_sequence,
    'enrolled_at',       p_enrolled_at,
    'prorated_cents',    v_price.prorated_cents,
    'days_remaining',    v_price.proration_days,
    'full_year_cents',   v_price.discounted_annual_cents,
    'service_allowances', v_sa_result
  );
END;
$$;

GRANT EXECUTE ON FUNCTION admin_enroll_location TO authenticated;

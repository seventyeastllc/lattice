-- Phase 7: Membership Billing Engine
--
-- Rules implemented:
--   • One tier per org, all enrolled locations share it
--   • Locations 1–2: full annual price; location 3+: 10% discount
--   • 4 staff seats included per location; extras at $150/yr
--   • Additions/upgrades prorated to renewal date; benefits too
--   • Downgrades/reductions deferred to next renewal (pending_changes)
--   • Founding-member 2-year rate protection (tier, location price, seat price)
--     locked at the rate in effect when protection was set; additions inherit
--     the original protection end date, not a new 2-year window
--   • Service allowances: per-location, per-membership-year; unused expire
--     at renewal (TSE-delay exception recorded as an override row)
--   • Manual payment recording (Stripe disconnected)
--   • Simulated renewal dates

-- ─── 1. Extend organizations ─────────────────────────────────────────────────

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS rate_protection_end_date  date,
  -- Snapshot of prices locked in at enrollment for founder protection.
  -- NULL until founder protection is first set.
  ADD COLUMN IF NOT EXISTS protected_tier_price_cents        integer,
  ADD COLUMN IF NOT EXISTS protected_location_discount_pct   numeric(5,2),
  ADD COLUMN IF NOT EXISTS protected_staff_seat_annual_cents  integer;

-- ─── 2. Extend locations ─────────────────────────────────────────────────────

ALTER TABLE locations
  -- When this location was enrolled (used for proration baseline)
  ADD COLUMN IF NOT EXISTS enrolled_at  timestamptz;

-- ─── 3. billing_records — manual payment log ─────────────────────────────────

CREATE TABLE IF NOT EXISTS billing_records (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  recorded_by         uuid REFERENCES auth.users(id),
  amount_cents        integer NOT NULL CHECK (amount_cents > 0),
  payment_method      text NOT NULL DEFAULT 'check',   -- check | ach | card | other
  reference_number    text,
  memo                text,
  coverage_start      date,
  coverage_end        date,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS billing_records_org_idx ON billing_records(org_id);
GRANT SELECT ON billing_records TO authenticated;
GRANT INSERT ON billing_records TO authenticated;

-- ─── 4. pending_billing_changes — deferred downgrades / seat reductions ──────
--
-- A pending change is applied at the next renewal.  Only one pending change
-- per org is allowed; a new one replaces the old.

CREATE TABLE IF NOT EXISTS pending_billing_changes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  change_type     text NOT NULL,  -- 'tier_downgrade' | 'seat_reduction' | 'location_reduction'
  new_tier        text,           -- for tier_downgrade
  new_extra_staff_seats  integer, -- for seat_reduction (per-location value)
  new_location_count     integer, -- for location_reduction
  change_notes    text,
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON pending_billing_changes TO authenticated;

-- ─── 5. service_allowances — per-location, per-membership-year ───────────────

CREATE TABLE IF NOT EXISTS service_allowances (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id         uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  org_id              uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  membership_year     integer NOT NULL,  -- e.g. 1 = first year, 2 = second year
  allowance_type      text NOT NULL,     -- 'hours' | 'credits' | 'sessions'
  annual_amount       numeric(10,2) NOT NULL DEFAULT 0,
  used_amount         numeric(10,2) NOT NULL DEFAULT 0,
  remaining_amount    numeric(10,2) GENERATED ALWAYS AS (annual_amount - used_amount) STORED,
  year_start          date NOT NULL,
  year_end            date NOT NULL,
  expired_at          timestamptz,       -- NULL until renewal processes
  carry_over_amount   numeric(10,2),     -- if TSE approved carry-over before expiry
  carry_over_approved_by uuid REFERENCES auth.users(id),
  carry_over_note     text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id, allowance_type, membership_year)
);

CREATE INDEX IF NOT EXISTS service_allowances_location_idx ON service_allowances(location_id);
CREATE INDEX IF NOT EXISTS service_allowances_org_idx ON service_allowances(org_id);
GRANT SELECT ON service_allowances TO authenticated;
GRANT INSERT, UPDATE ON service_allowances TO authenticated;

-- ─── 6. Helper: days_until_renewal ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION days_until_renewal(p_renewal_date date)
RETURNS integer
LANGUAGE sql IMMUTABLE AS $$
  SELECT GREATEST(0, (p_renewal_date - CURRENT_DATE)::integer)
$$;

-- ─── 7. calculate_location_price — proration + founder protection ─────────────
--
-- Returns what it would cost to add/upgrade this location RIGHT NOW,
-- prorated to the org's renewal date.
--
-- p_scenario:
--   'full_year'   — no proration (for the annual invoice total)
--   'prorated'    — prorated from today to renewal
--
-- p_sequence: the location's sequence number (1, 2, 3, …)

CREATE OR REPLACE FUNCTION calculate_location_price(
  p_org_id      uuid,
  p_sequence    integer,
  p_scenario    text DEFAULT 'prorated'  -- 'full_year' | 'prorated'
)
RETURNS TABLE (
  base_annual_cents        integer,
  discount_pct             numeric(5,2),
  discounted_annual_cents  integer,
  proration_days           integer,
  total_days_in_year       integer,
  prorated_cents           integer,
  is_founder_protected     boolean,
  protection_end_date      date
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_org         record;
  v_config      record;
  v_tier_price  integer;
  v_disc_pct    numeric(5,2);
  v_seat_price  integer;
  v_annual      integer;
  v_disc_annual integer;
  v_days_left   integer;
  v_year_days   integer;
  v_prorated    integer;
  v_protected   boolean;
BEGIN
  -- Load org
  SELECT o.tier, o.renewal_date, o.is_founding_member,
         o.rate_protection_end_date,
         o.protected_tier_price_cents,
         o.protected_location_discount_pct,
         o.protected_staff_seat_annual_cents
  INTO v_org
  FROM organizations o WHERE o.id = p_org_id;

  -- Load billing config for this tier
  SELECT bc.annual_price_cents, bc.location_discount_pct, bc.additional_staff_annual_cents
  INTO v_config
  FROM billing_config bc WHERE bc.tier = v_org.tier;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No billing_config row for tier %', v_org.tier;
  END IF;

  -- Founder rate protection overrides if still active
  v_protected := v_org.rate_protection_end_date IS NOT NULL
                 AND v_org.rate_protection_end_date >= CURRENT_DATE
                 AND v_org.protected_tier_price_cents IS NOT NULL;

  IF v_protected THEN
    v_tier_price := v_org.protected_tier_price_cents;
    v_disc_pct   := COALESCE(v_org.protected_location_discount_pct, v_config.location_discount_pct);
  ELSE
    v_tier_price := v_config.annual_price_cents;
    v_disc_pct   := v_config.location_discount_pct;
  END IF;

  -- Apply location sequence discount (location 3+ gets the discount)
  IF p_sequence >= 3 THEN
    v_disc_annual := ROUND(v_tier_price * (1 - v_disc_pct / 100))::integer;
  ELSE
    v_disc_annual := v_tier_price;
    v_disc_pct    := 0;
  END IF;

  -- Proration
  IF p_scenario = 'prorated' AND v_org.renewal_date IS NOT NULL THEN
    v_days_left := days_until_renewal(v_org.renewal_date);
    v_year_days := 365;
    v_prorated  := ROUND(v_disc_annual * v_days_left::numeric / v_year_days)::integer;
  ELSE
    v_days_left := 365;
    v_year_days := 365;
    v_prorated  := v_disc_annual;
  END IF;

  RETURN QUERY SELECT
    v_tier_price,
    v_disc_pct,
    v_disc_annual,
    v_days_left,
    v_year_days,
    v_prorated,
    v_protected,
    v_org.rate_protection_end_date;
END;
$$;

GRANT EXECUTE ON FUNCTION calculate_location_price TO authenticated;

-- ─── 8. calculate_org_annual_total — full invoice amount ──────────────────────
--
-- Returns the total annual billing for an org: all active enrolled locations
-- + extra staff seats.

CREATE OR REPLACE FUNCTION calculate_org_annual_total(p_org_id uuid)
RETURNS TABLE (
  location_id               uuid,
  location_name             text,
  location_sequence         integer,
  base_annual_cents         integer,
  discount_pct              numeric(5,2),
  location_annual_cents     integer,
  extra_staff_seats         integer,
  staff_seat_annual_cents   integer,
  line_total_cents          integer
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_org      record;
  v_config   record;
  v_seat_price integer;
  v_protected boolean;
BEGIN
  SELECT o.tier, o.renewal_date, o.rate_protection_end_date,
         o.protected_tier_price_cents, o.protected_staff_seat_annual_cents
  INTO v_org FROM organizations o WHERE o.id = p_org_id;

  SELECT bc.annual_price_cents, bc.additional_staff_annual_cents
  INTO v_config FROM billing_config bc WHERE bc.tier = v_org.tier;

  v_protected := v_org.rate_protection_end_date IS NOT NULL
                 AND v_org.rate_protection_end_date >= CURRENT_DATE
                 AND v_org.protected_tier_price_cents IS NOT NULL;

  v_seat_price := CASE WHEN v_protected AND v_org.protected_staff_seat_annual_cents IS NOT NULL
                       THEN v_org.protected_staff_seat_annual_cents
                       ELSE v_config.additional_staff_annual_cents END;

  RETURN QUERY
    SELECT
      l.id,
      l.name,
      l.location_sequence,
      p.base_annual_cents,
      p.discount_pct,
      p.discounted_annual_cents,
      COALESCE(l.extra_staff_seats, 0),
      v_seat_price,
      p.discounted_annual_cents + (COALESCE(l.extra_staff_seats, 0) * v_seat_price)
    FROM locations l
    CROSS JOIN LATERAL calculate_location_price(p_org_id, l.location_sequence, 'full_year') p
    WHERE l.org_id = p_org_id
      AND l.is_active = true
      AND l.enrollment_date IS NOT NULL
    ORDER BY l.location_sequence;
END;
$$;

GRANT EXECUTE ON FUNCTION calculate_org_annual_total TO authenticated;

-- ─── 9. Admin RPC: record a manual payment ────────────────────────────────────

CREATE OR REPLACE FUNCTION admin_record_payment(
  p_org_id          uuid,
  p_amount_cents    integer,
  p_payment_method  text DEFAULT 'check',
  p_reference       text DEFAULT NULL,
  p_memo            text DEFAULT NULL,
  p_coverage_start  date DEFAULT NULL,
  p_coverage_end    date DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO billing_records (org_id, recorded_by, amount_cents, payment_method,
                               reference_number, memo, coverage_start, coverage_end)
  VALUES (p_org_id, auth.uid(), p_amount_cents, p_payment_method,
          p_reference, p_memo, p_coverage_start, p_coverage_end)
  RETURNING id INTO v_id;

  -- Mark org as paid if it currently isn't
  UPDATE organizations
  SET payment_status = 'paid'
  WHERE id = p_org_id AND payment_status != 'paid';

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_record_payment TO authenticated;

-- ─── 10. Admin RPC: set founder rate protection ───────────────────────────────
--
-- Locks in current billing_config prices for 2 years from p_start_date.
-- Called once when an org is designated a founding member.

CREATE OR REPLACE FUNCTION admin_set_founder_protection(
  p_org_id      uuid,
  p_start_date  date DEFAULT CURRENT_DATE,
  p_years       integer DEFAULT 2
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_tier   text;
  v_config record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT tier INTO v_tier FROM organizations WHERE id = p_org_id;

  SELECT annual_price_cents, location_discount_pct, additional_staff_annual_cents
  INTO v_config FROM billing_config WHERE tier = v_tier;

  UPDATE organizations
  SET is_founding_member              = true,
      rate_protection_end_date        = p_start_date + (p_years || ' years')::interval,
      protected_tier_price_cents      = v_config.annual_price_cents,
      protected_location_discount_pct = v_config.location_discount_pct,
      protected_staff_seat_annual_cents = v_config.additional_staff_annual_cents
  WHERE id = p_org_id;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_set_founder_protection TO authenticated;

-- ─── 11. Admin RPC: queue a deferred downgrade ───────────────────────────────

CREATE OR REPLACE FUNCTION admin_queue_tier_downgrade(
  p_org_id    uuid,
  p_new_tier  text,
  p_notes     text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO pending_billing_changes (org_id, change_type, new_tier, change_notes, created_by)
  VALUES (p_org_id, 'tier_downgrade', p_new_tier, p_notes, auth.uid())
  ON CONFLICT (org_id) DO UPDATE
    SET change_type  = 'tier_downgrade',
        new_tier     = EXCLUDED.new_tier,
        change_notes = EXCLUDED.change_notes,
        created_by   = EXCLUDED.created_by,
        created_at   = now();
END;
$$;

GRANT EXECUTE ON FUNCTION admin_queue_tier_downgrade TO authenticated;

-- ─── 12. Admin RPC: process renewal ──────────────────────────────────────────
--
-- Steps performed at renewal:
--   1. Apply any pending tier/seat/location changes
--   2. Expire service allowances for the closing year (record carry-overs)
--   3. Create new service allowance rows for the new year
--   4. Advance renewal_date by one year
--   5. Remove the pending_billing_changes row

CREATE OR REPLACE FUNCTION admin_process_renewal(
  p_org_id              uuid,
  p_new_renewal_date    date DEFAULT NULL,  -- defaults to renewal_date + 1 year
  p_annual_hours        numeric DEFAULT 0,  -- service hours to allocate per location
  p_allowance_type      text DEFAULT 'hours'
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_org          record;
  v_pending      record;
  v_old_year_end date;
  v_new_year_start date;
  v_new_year_end   date;
  v_loc          record;
  v_year_num     integer;
  v_result       jsonb := '{}'::jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_org FROM organizations WHERE id = p_org_id;

  v_old_year_end   := COALESCE(v_org.renewal_date, CURRENT_DATE);
  v_new_year_start := v_old_year_end + 1;
  v_new_year_end   := COALESCE(p_new_renewal_date, v_old_year_end + interval '1 year')::date;

  -- Step 1: apply pending changes
  SELECT * INTO v_pending FROM pending_billing_changes WHERE org_id = p_org_id;

  IF FOUND THEN
    IF v_pending.change_type = 'tier_downgrade' AND v_pending.new_tier IS NOT NULL THEN
      UPDATE organizations SET tier = v_pending.new_tier WHERE id = p_org_id;
    END IF;
    -- seat_reduction: apply per-location later if needed (extend as requirements grow)
    DELETE FROM pending_billing_changes WHERE org_id = p_org_id;
    v_result := v_result || jsonb_build_object('applied_pending_change', v_pending.change_type);
  END IF;

  -- Step 2 & 3: allowances per location
  FOR v_loc IN
    SELECT l.id, l.location_sequence
    FROM locations l
    WHERE l.org_id = p_org_id AND l.is_active = true AND l.enrollment_date IS NOT NULL
  LOOP
    -- Determine membership year number for the new period
    SELECT COALESCE(MAX(sa.membership_year), 0) + 1
    INTO v_year_num
    FROM service_allowances sa
    WHERE sa.location_id = v_loc.id AND sa.allowance_type = p_allowance_type;

    -- Expire allowances for the closing year
    UPDATE service_allowances
    SET expired_at = now()
    WHERE location_id = v_loc.id
      AND allowance_type = p_allowance_type
      AND expired_at IS NULL
      AND year_end <= v_old_year_end;

    -- Create new allowance for the coming year
    IF p_annual_hours > 0 THEN
      INSERT INTO service_allowances (
        location_id, org_id, membership_year, allowance_type,
        annual_amount, used_amount, year_start, year_end
      ) VALUES (
        v_loc.id, p_org_id, v_year_num, p_allowance_type,
        p_annual_hours, 0, v_new_year_start, v_new_year_end
      )
      ON CONFLICT (location_id, allowance_type, membership_year) DO NOTHING;
    END IF;
  END LOOP;

  -- Step 4: advance renewal date
  UPDATE organizations
  SET renewal_date = v_new_year_end
  WHERE id = p_org_id;

  v_result := v_result || jsonb_build_object(
    'org_id',           p_org_id,
    'old_renewal_date', v_old_year_end,
    'new_renewal_date', v_new_year_end,
    'locations_processed', (
      SELECT COUNT(*) FROM locations
      WHERE org_id = p_org_id AND is_active = true AND enrollment_date IS NOT NULL
    )
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_process_renewal TO authenticated;

-- ─── 13. Admin RPC: enroll a location (adds to billing) ──────────────────────
--
-- Sets enrollment_date, assigns location_sequence (next available for org),
-- and creates service_allowances row for year 1 if hours provided.

CREATE OR REPLACE FUNCTION admin_enroll_location(
  p_location_id    uuid,
  p_annual_hours   numeric DEFAULT 0,
  p_allowance_type text DEFAULT 'hours',
  p_enrolled_at    timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_loc       record;
  v_org       record;
  v_sequence  integer;
  v_year_end  date;
  v_price     record;
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

  -- Create year 1 service allowance
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

  -- Calculate prorated price for reference
  SELECT * INTO v_price FROM calculate_location_price(v_loc.org_id, v_sequence, 'prorated');

  RETURN jsonb_build_object(
    'location_id',      p_location_id,
    'location_sequence', v_sequence,
    'enrolled_at',      p_enrolled_at,
    'prorated_cents',   v_price.prorated_cents,
    'days_remaining',   v_price.proration_days,
    'full_year_cents',  v_price.discounted_annual_cents
  );
END;
$$;

GRANT EXECUTE ON FUNCTION admin_enroll_location TO authenticated;

-- ─── 14. Admin RPC: approve service allowance carry-over ─────────────────────

CREATE OR REPLACE FUNCTION admin_approve_allowance_carryover(
  p_allowance_id  uuid,
  p_carry_amount  numeric,
  p_note          text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE service_allowances
  SET carry_over_amount     = p_carry_amount,
      carry_over_approved_by = auth.uid(),
      carry_over_note        = p_note
  WHERE id = p_allowance_id;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_approve_allowance_carryover TO authenticated;

-- ─── 15. Admin RPC: get billing summary for an org ───────────────────────────

CREATE OR REPLACE FUNCTION admin_get_org_billing(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_org        record;
  v_pending    record;
  v_lines      jsonb;
  v_payments   jsonb;
  v_allowances jsonb;
  v_total      integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT o.id, o.name, o.tier, o.renewal_date, o.payment_status,
         o.is_founding_member, o.rate_protection_end_date,
         o.protected_tier_price_cents
  INTO v_org FROM organizations o WHERE o.id = p_org_id;

  SELECT jsonb_agg(jsonb_build_object(
    'location_id',           t.location_id,
    'location_name',         t.location_name,
    'sequence',              t.location_sequence,
    'base_annual_cents',     t.base_annual_cents,
    'discount_pct',          t.discount_pct,
    'location_annual_cents', t.location_annual_cents,
    'extra_staff_seats',     t.extra_staff_seats,
    'staff_seat_annual_cents', t.staff_seat_annual_cents,
    'line_total_cents',      t.line_total_cents
  ) ORDER BY t.location_sequence)
  INTO v_lines
  FROM calculate_org_annual_total(p_org_id) t;

  SELECT COALESCE(SUM(line_total_cents), 0) INTO v_total
  FROM calculate_org_annual_total(p_org_id);

  SELECT jsonb_agg(jsonb_build_object(
    'id',             br.id,
    'amount_cents',   br.amount_cents,
    'payment_method', br.payment_method,
    'reference',      br.reference_number,
    'memo',           br.memo,
    'coverage_start', br.coverage_start,
    'coverage_end',   br.coverage_end,
    'created_at',     br.created_at
  ) ORDER BY br.created_at DESC)
  INTO v_payments
  FROM billing_records br WHERE br.org_id = p_org_id;

  SELECT jsonb_agg(jsonb_build_object(
    'id',              sa.id,
    'location_id',     sa.location_id,
    'allowance_type',  sa.allowance_type,
    'membership_year', sa.membership_year,
    'annual_amount',   sa.annual_amount,
    'used_amount',     sa.used_amount,
    'remaining',       sa.remaining_amount,
    'year_start',      sa.year_start,
    'year_end',        sa.year_end,
    'expired_at',      sa.expired_at,
    'carry_over',      sa.carry_over_amount
  ) ORDER BY sa.membership_year DESC, sa.location_id)
  INTO v_allowances
  FROM service_allowances sa WHERE sa.org_id = p_org_id;

  SELECT to_jsonb(pbc.*) INTO v_pending FROM pending_billing_changes pbc WHERE pbc.org_id = p_org_id;

  RETURN jsonb_build_object(
    'org',                v_org,
    'annual_total_cents', v_total,
    'line_items',         COALESCE(v_lines, '[]'::jsonb),
    'payments',           COALESCE(v_payments, '[]'::jsonb),
    'service_allowances', COALESCE(v_allowances, '[]'::jsonb),
    'pending_change',     v_pending
  );
END;
$$;

GRANT EXECUTE ON FUNCTION admin_get_org_billing TO authenticated;

-- ─── 16. Grants on new tables to service_role ────────────────────────────────

GRANT ALL ON billing_records TO service_role;
GRANT ALL ON pending_billing_changes TO service_role;
GRANT ALL ON service_allowances TO service_role;

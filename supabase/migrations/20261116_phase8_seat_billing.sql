-- Phase 8d: Extra seat billing RPCs

-- ─── admin_add_extra_seats ────────────────────────────────────────────────────
-- Adds N extra seats to a location after confirming payment.
-- Idempotent: a second call with the same amount+date returns the existing record.
CREATE OR REPLACE FUNCTION admin_add_extra_seats(
  p_location_id           uuid,
  p_seats                 integer,
  p_payment_amount_cents  integer
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_loc       record;
  v_org       record;
  v_bc        record;
  v_days      integer;
  v_seat_rate integer;
  v_prorated  integer;
  v_br_id     uuid;
  v_today     date := CURRENT_DATE;
BEGIN
  -- Auth check: TSE admin only
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF p_seats <= 0 THEN RAISE EXCEPTION 'seats must be positive'; END IF;

  SELECT l.*, o.id AS o_id, o.rate_protection_end_date, o.protected_staff_seat_annual_cents,
         o.enrolled_at, o.tier
  INTO v_loc
  FROM locations l
  JOIN organizations o ON o.id = l.org_id
  WHERE l.id = p_location_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Location not found'; END IF;

  -- Determine seat rate (founder protection if still active)
  SELECT * INTO v_bc FROM billing_config
  WHERE tier = COALESCE(v_loc.tier, 'participant');

  IF v_loc.rate_protection_end_date IS NOT NULL
     AND v_loc.rate_protection_end_date > v_today
     AND v_loc.protected_staff_seat_annual_cents IS NOT NULL THEN
    v_seat_rate := v_loc.protected_staff_seat_annual_cents;
  ELSE
    v_seat_rate := v_bc.additional_staff_annual_cents;
  END IF;

  -- Proration: days until renewal / 365
  -- Renewal date approximated as anniversary of enrolled_at
  DECLARE
    v_renewal_date date;
  BEGIN
    IF v_loc.enrolled_at IS NOT NULL THEN
      v_renewal_date := (v_loc.enrolled_at::date + interval '1 year')::date;
      -- Roll forward if already past
      WHILE v_renewal_date <= v_today LOOP
        v_renewal_date := (v_renewal_date + interval '1 year')::date;
      END LOOP;
    ELSE
      -- No enrolled_at: charge full year
      v_renewal_date := v_today + interval '1 year';
    END IF;
    v_days := GREATEST(0, (v_renewal_date - v_today)::integer);
  END;

  v_prorated := ROUND(v_seat_rate::numeric * p_seats * v_days / 365.0)::integer;

  -- Idempotency: same amount recorded today for this location → return existing
  SELECT id INTO v_br_id
  FROM billing_records
  WHERE location_id = p_location_id
    AND record_type = 'payment'
    AND amount_cents = p_payment_amount_cents
    AND recorded_at::date = v_today
    AND notes LIKE '%extra_seats%'
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object('billing_record_id', v_br_id, 'idempotent', true,
      'extra_seats_total', (SELECT extra_staff_seats FROM locations WHERE id = p_location_id));
  END IF;

  -- Activate capacity
  UPDATE locations
  SET extra_staff_seats = COALESCE(extra_staff_seats, 0) + p_seats
  WHERE id = p_location_id;

  -- Record payment
  INSERT INTO billing_records (org_id, location_id, record_type, amount_cents, notes)
  SELECT l.org_id, p_location_id, 'payment', p_payment_amount_cents,
    'extra_seats: +' || p_seats || ' seats, prorated ' || v_days || ' days @ $' ||
    (v_seat_rate / 100) || '/seat/yr'
  FROM locations l WHERE l.id = p_location_id
  RETURNING id INTO v_br_id;

  RETURN jsonb_build_object(
    'billing_record_id', v_br_id,
    'seats_added',       p_seats,
    'prorated_cents',    v_prorated,
    'days_remaining',    v_days,
    'idempotent',        false
  );
END;
$$;
GRANT EXECUTE ON FUNCTION admin_add_extra_seats TO authenticated;

-- ─── admin_queue_seat_reduction ──────────────────────────────────────────────
-- Queues a seat reduction to take effect at next renewal.
CREATE OR REPLACE FUNCTION admin_queue_seat_reduction(
  p_location_id uuid,
  p_reduce_by   integer
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  IF p_reduce_by <= 0 THEN RAISE EXCEPTION 'reduce_by must be positive'; END IF;

  INSERT INTO pending_billing_changes (org_id, location_id, change_type, change_value, notes)
  SELECT l.org_id, p_location_id, 'seat_reduction', p_reduce_by,
    'Queue ' || p_reduce_by || ' seat reduction at renewal'
  FROM locations l WHERE l.id = p_location_id
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION admin_queue_seat_reduction TO authenticated;

-- ─── admin_get_seat_billing_preview ──────────────────────────────────────────
-- Returns the prorated cost for adding N seats to a location.
CREATE OR REPLACE FUNCTION admin_get_seat_billing_preview(
  p_location_id uuid,
  p_seats       integer DEFAULT 1
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_loc         record;
  v_bc          record;
  v_days        integer;
  v_seat_rate   integer;
  v_prorated    integer;
  v_today       date := CURRENT_DATE;
  v_renewal_date date;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT l.extra_staff_seats, l.enrolled_at, o.rate_protection_end_date,
         o.protected_staff_seat_annual_cents, o.tier
  INTO v_loc
  FROM locations l JOIN organizations o ON o.id = l.org_id
  WHERE l.id = p_location_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Location not found'; END IF;

  SELECT * INTO v_bc FROM billing_config
  WHERE tier = COALESCE(v_loc.tier, 'participant');

  IF v_loc.rate_protection_end_date IS NOT NULL
     AND v_loc.rate_protection_end_date > v_today
     AND v_loc.protected_staff_seat_annual_cents IS NOT NULL THEN
    v_seat_rate := v_loc.protected_staff_seat_annual_cents;
  ELSE
    v_seat_rate := v_bc.additional_staff_annual_cents;
  END IF;

  IF v_loc.enrolled_at IS NOT NULL THEN
    v_renewal_date := (v_loc.enrolled_at::date + interval '1 year')::date;
    WHILE v_renewal_date <= v_today LOOP
      v_renewal_date := (v_renewal_date + interval '1 year')::date;
    END LOOP;
  ELSE
    v_renewal_date := v_today + interval '1 year';
  END IF;
  v_days := GREATEST(0, (v_renewal_date - v_today)::integer);

  v_prorated := ROUND(v_seat_rate::numeric * p_seats * v_days / 365.0)::integer;

  RETURN jsonb_build_object(
    'seat_rate_cents',          v_seat_rate,
    'prorated_cents',           v_prorated,
    'days_remaining',           v_days,
    'renewal_date',             v_renewal_date,
    'founder_rate_active',      v_loc.rate_protection_end_date IS NOT NULL
                                AND v_loc.rate_protection_end_date > v_today,
    'current_extra_seats',      COALESCE(v_loc.extra_staff_seats, 0)
  );
END;
$$;
GRANT EXECUTE ON FUNCTION admin_get_seat_billing_preview TO authenticated;

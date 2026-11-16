-- Phase 8: Fix admin_get_seat_billing_preview to use org billing record for renewal date
-- Uses most recent billing_records.coverage_end for org, not location enrollment anniversary.

CREATE OR REPLACE FUNCTION admin_get_seat_billing_preview(p_location_id uuid, p_seats integer DEFAULT 1)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
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

  SELECT l.extra_staff_seats, l.enrolled_at, l.org_id,
         o.rate_protection_end_date, o.protected_staff_seat_annual_cents, o.tier
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

  -- Use org billing records to determine renewal date (most recent coverage_end)
  SELECT coverage_end INTO v_renewal_date
  FROM billing_records
  WHERE org_id = v_loc.org_id
  ORDER BY coverage_end DESC
  LIMIT 1;

  IF v_renewal_date IS NOT NULL THEN
    -- Advance past today if the coverage has already elapsed
    WHILE v_renewal_date <= v_today LOOP
      v_renewal_date := (v_renewal_date + interval '1 year')::date;
    END LOOP;
  ELSIF v_loc.enrolled_at IS NOT NULL THEN
    -- Fallback: location enrollment anniversary
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

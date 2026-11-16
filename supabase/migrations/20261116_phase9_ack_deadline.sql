-- Phase 9: Connection-request acknowledgment deadline (2 business days, America/New_York)
--
-- Adds:
--   1. acknowledged_at, resolved_at, ack_deadline columns on connection_requests
--   2. next_business_day_deadline() — IMMUTABLE helper; skips Sat/Sun in given TZ
--   3. trg_set_ack_deadline        — sets ack_deadline on INSERT
--   4. acknowledge_connection_request(p_request_id) — provider marks ack; sets acknowledged_at + status='active'
--   5. get_incoming_connection_requests(p_org_id)   — provider view: pending+active with deadline/overdue
--   6. admin_get_connection_requests()              — TSE admin view: all orgs, all statuses, with deadline/overdue
--
-- Intentionally separate from listing-confirmation deadlines, which use elapsed calendar hours.

-- ─── 1. Schema ────────────────────────────────────────────────────────────────

ALTER TABLE connection_requests
  ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS resolved_at     timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ack_deadline    timestamptz DEFAULT NULL;

-- Back-fill deadline for existing pending/active requests that pre-date this migration
UPDATE connection_requests
SET ack_deadline = (
  -- inline the same logic as next_business_day_deadline(created_at, 2)
  WITH base AS (
    SELECT (created_at AT TIME ZONE 'America/New_York')::date AS sub_date
  ),
  start_day AS (
    SELECT CASE
      WHEN EXTRACT(DOW FROM sub_date) = 0 THEN sub_date + 1  -- Sun → Mon
      WHEN EXTRACT(DOW FROM sub_date) = 6 THEN sub_date + 2  -- Sat → Mon
      ELSE sub_date
    END AS d FROM base
  ),
  day1 AS (
    SELECT CASE
      WHEN EXTRACT(DOW FROM d + 1) IN (0,6)
        THEN CASE WHEN EXTRACT(DOW FROM d + 1) = 6 THEN d + 3 ELSE d + 2 END
      ELSE d + 1
    END AS d FROM start_day
  ),
  day2 AS (
    SELECT CASE
      WHEN EXTRACT(DOW FROM d + 1) IN (0,6)
        THEN CASE WHEN EXTRACT(DOW FROM d + 1) = 6 THEN d + 3 ELSE d + 2 END
      ELSE d + 1
    END AS d FROM day1
  )
  SELECT ((d::text || ' 17:00:00')::timestamp AT TIME ZONE 'America/New_York') FROM day2
)
WHERE status IN ('pending', 'active') AND ack_deadline IS NULL;

-- ─── 2. next_business_day_deadline ───────────────────────────────────────────
-- Returns the timestamp at 17:00 (5 pm) in p_tz on the p_days-th business day
-- after p_start, counting forward and skipping Saturdays and Sundays.
-- Weekend submissions are treated as if submitted at the start of the next Monday
-- (the first partial weekend day does not count as a business day).

CREATE OR REPLACE FUNCTION next_business_day_deadline(
  p_start timestamptz,
  p_days  integer DEFAULT 2,
  p_tz    text    DEFAULT 'America/New_York'
)
RETURNS timestamptz
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_dt  date;
  v_cnt integer := 0;
BEGIN
  v_dt := (p_start AT TIME ZONE p_tz)::date;

  -- Normalize weekend submission to the following Monday
  IF EXTRACT(DOW FROM v_dt) = 0 THEN   -- Sunday
    v_dt := v_dt + 1;
  ELSIF EXTRACT(DOW FROM v_dt) = 6 THEN -- Saturday
    v_dt := v_dt + 2;
  END IF;

  -- Advance forward p_days business days
  WHILE v_cnt < p_days LOOP
    v_dt := v_dt + 1;
    IF EXTRACT(DOW FROM v_dt) NOT IN (0, 6) THEN  -- Mon–Fri
      v_cnt := v_cnt + 1;
    END IF;
  END LOOP;

  RETURN ((v_dt::text || ' 17:00:00')::timestamp AT TIME ZONE p_tz);
END;
$$;

-- ─── 3. Trigger: set ack_deadline on INSERT ───────────────────────────────────

CREATE OR REPLACE FUNCTION trg_set_ack_deadline_fn()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.ack_deadline := next_business_day_deadline(NEW.created_at, 2, 'America/New_York');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_ack_deadline ON connection_requests;
CREATE TRIGGER trg_set_ack_deadline
  BEFORE INSERT ON connection_requests
  FOR EACH ROW EXECUTE FUNCTION trg_set_ack_deadline_fn();

-- ─── 4. acknowledge_connection_request ───────────────────────────────────────
-- Called by the responsible provider (org_admin or staff of the target org).
-- Sets acknowledged_at and advances status to 'active'.
-- Idempotent: safe to call twice.

CREATE OR REPLACE FUNCTION acknowledge_connection_request(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_req record;
BEGIN
  SELECT cr.*, o.id AS oid
  INTO v_req
  FROM connection_requests cr
  JOIN organizations o ON o.id = cr.target_organization_id
  WHERE cr.id = p_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Connection request not found';
  END IF;

  -- Must be an org_admin or active staff member of the target org, OR TSE admin
  IF NOT EXISTS (
    SELECT 1 FROM org_members
    WHERE org_id = v_req.target_organization_id
      AND user_id = auth.uid()
      AND status = 'active'
  ) AND NOT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only members of the receiving organization can acknowledge this request';
  END IF;

  IF v_req.acknowledged_at IS NOT NULL THEN
    -- Already acknowledged — return current state, no error
    RETURN jsonb_build_object('already_acknowledged', true, 'acknowledged_at', v_req.acknowledged_at);
  END IF;

  UPDATE connection_requests
  SET acknowledged_at = now(),
      status          = CASE WHEN status = 'pending' THEN 'active' ELSE status END,
      updated_at      = now()
  WHERE id = p_request_id;

  RETURN jsonb_build_object('acknowledged_at', now(), 'already_acknowledged', false);
END;
$$;

GRANT EXECUTE ON FUNCTION acknowledge_connection_request TO authenticated;

-- ─── 5. get_incoming_connection_requests ─────────────────────────────────────
-- Returns pending and active requests targeted at p_org_id.
-- Callable by org_admin or active staff of that org, or TSE admin.
-- Includes deadline and computed is_ack_overdue.

CREATE OR REPLACE FUNCTION get_incoming_connection_requests(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rows jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM org_members
    WHERE org_id = p_org_id AND user_id = auth.uid() AND status = 'active'
  ) AND NOT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'id',               cr.id,
    'request_type',     cr.request_type,
    'notes',            cr.notes,
    'status',           cr.status,
    'created_at',       cr.created_at,
    'ack_deadline',     cr.ack_deadline,
    'acknowledged_at',  cr.acknowledged_at,
    'resolved_at',      cr.resolved_at,
    'is_ack_overdue',   (cr.acknowledged_at IS NULL AND cr.ack_deadline IS NOT NULL AND now() > cr.ack_deadline),
    'requester_name',   u.raw_user_meta_data->>'full_name',
    'requester_email',  u.email,
    'requester_org',    ro.name
  ) ORDER BY cr.created_at DESC)
  INTO v_rows
  FROM connection_requests cr
  JOIN auth.users u ON u.id = cr.requesting_user_id
  LEFT JOIN organizations ro ON ro.id = (
    SELECT o2.id FROM org_members om2
    JOIN organizations o2 ON o2.id = om2.org_id
    WHERE om2.user_id = cr.requesting_user_id AND om2.status = 'active'
    LIMIT 1
  )
  WHERE cr.target_organization_id = p_org_id
    AND cr.status IN ('pending', 'active');

  RETURN COALESCE(v_rows, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION get_incoming_connection_requests TO authenticated;

-- ─── 6. admin_get_connection_requests ────────────────────────────────────────
-- TSE admin: all connection requests across all orgs with deadline/overdue.

CREATE OR REPLACE FUNCTION admin_get_connection_requests(
  p_status text DEFAULT NULL   -- NULL = all; 'pending','active','resolved','closed'
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rows jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'id',               cr.id,
    'request_type',     cr.request_type,
    'notes',            cr.notes,
    'status',           cr.status,
    'created_at',       cr.created_at,
    'ack_deadline',     cr.ack_deadline,
    'acknowledged_at',  cr.acknowledged_at,
    'resolved_at',      cr.resolved_at,
    'is_ack_overdue',   (cr.acknowledged_at IS NULL AND cr.ack_deadline IS NOT NULL AND now() > cr.ack_deadline),
    'target_org_id',    cr.target_organization_id,
    'target_org_name',  torg.name,
    'requester_name',   u.raw_user_meta_data->>'full_name',
    'requester_email',  u.email
  ) ORDER BY cr.created_at DESC)
  INTO v_rows
  FROM connection_requests cr
  JOIN organizations torg ON torg.id = cr.target_organization_id
  JOIN auth.users u ON u.id = cr.requesting_user_id
  WHERE (p_status IS NULL OR cr.status = p_status);

  RETURN COALESCE(v_rows, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_get_connection_requests TO authenticated;

-- ─── RLS: target org members can view connection requests aimed at their org ──
-- (Requesting user already has SELECT via "Users can view own connection requests")

DROP POLICY IF EXISTS "Target org members can view incoming requests" ON connection_requests;
CREATE POLICY "Target org members can view incoming requests"
  ON connection_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_id = target_organization_id
        AND user_id = auth.uid()
        AND status = 'active'
    )
  );

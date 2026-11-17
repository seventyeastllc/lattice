-- Phase 10: Holiday-aware business days + connection request workflow enhancements
-- Apply after: 20261116_phase9_service_allowances.sql

-- =============================================================================
-- 1. US FEDERAL HOLIDAYS TABLE (2025-2030, observed dates)
-- =============================================================================

CREATE TABLE IF NOT EXISTS us_federal_holidays (
  holiday_date date PRIMARY KEY,
  holiday_name text NOT NULL
);

-- Only insert if not already populated
INSERT INTO us_federal_holidays (holiday_date, holiday_name) VALUES
  ('2025-01-01', 'New Year''s Day'),
  ('2025-01-20', 'MLK Jr. Day'),
  ('2025-02-17', 'Presidents'' Day'),
  ('2025-05-26', 'Memorial Day'),
  ('2025-06-19', 'Juneteenth'),
  ('2025-07-04', 'Independence Day'),
  ('2025-09-01', 'Labor Day'),
  ('2025-10-13', 'Columbus Day'),
  ('2025-11-11', 'Veterans Day'),
  ('2025-11-27', 'Thanksgiving'),
  ('2025-12-25', 'Christmas Day'),
  ('2026-01-01', 'New Year''s Day'),
  ('2026-01-19', 'MLK Jr. Day'),
  ('2026-02-16', 'Presidents'' Day'),
  ('2026-05-25', 'Memorial Day'),
  ('2026-06-19', 'Juneteenth'),
  ('2026-07-03', 'Independence Day (observed)'),
  ('2026-09-07', 'Labor Day'),
  ('2026-10-12', 'Columbus Day'),
  ('2026-11-11', 'Veterans Day'),
  ('2026-11-26', 'Thanksgiving'),
  ('2026-12-25', 'Christmas Day'),
  ('2027-01-01', 'New Year''s Day'),
  ('2027-01-18', 'MLK Jr. Day'),
  ('2027-02-15', 'Presidents'' Day'),
  ('2027-05-31', 'Memorial Day'),
  ('2027-06-18', 'Juneteenth (observed)'),
  ('2027-07-05', 'Independence Day (observed)'),
  ('2027-09-06', 'Labor Day'),
  ('2027-10-11', 'Columbus Day'),
  ('2027-11-11', 'Veterans Day'),
  ('2027-11-25', 'Thanksgiving'),
  ('2027-12-24', 'Christmas Day (observed)'),
  ('2027-12-31', 'New Year''s Day (observed)'),
  ('2028-01-17', 'MLK Jr. Day'),
  ('2028-02-21', 'Presidents'' Day'),
  ('2028-05-29', 'Memorial Day'),
  ('2028-06-19', 'Juneteenth'),
  ('2028-07-04', 'Independence Day'),
  ('2028-09-04', 'Labor Day'),
  ('2028-10-09', 'Columbus Day'),
  ('2028-11-10', 'Veterans Day (observed)'),
  ('2028-11-23', 'Thanksgiving'),
  ('2028-12-25', 'Christmas Day'),
  ('2029-01-01', 'New Year''s Day'),
  ('2029-01-15', 'MLK Jr. Day'),
  ('2029-02-19', 'Presidents'' Day'),
  ('2029-05-28', 'Memorial Day'),
  ('2029-06-19', 'Juneteenth'),
  ('2029-07-04', 'Independence Day'),
  ('2029-09-03', 'Labor Day'),
  ('2029-10-08', 'Columbus Day'),
  ('2029-11-12', 'Veterans Day (observed)'),
  ('2029-11-22', 'Thanksgiving'),
  ('2029-12-25', 'Christmas Day'),
  ('2030-01-01', 'New Year''s Day'),
  ('2030-01-21', 'MLK Jr. Day'),
  ('2030-02-18', 'Presidents'' Day'),
  ('2030-05-27', 'Memorial Day'),
  ('2030-06-19', 'Juneteenth'),
  ('2030-07-04', 'Independence Day'),
  ('2030-09-02', 'Labor Day'),
  ('2030-10-14', 'Columbus Day'),
  ('2030-11-11', 'Veterans Day'),
  ('2030-11-28', 'Thanksgiving'),
  ('2030-12-25', 'Christmas Day')
ON CONFLICT (holiday_date) DO NOTHING;

-- =============================================================================
-- 2. UPDATED BUSINESS-DAY HELPERS (holiday-aware)
-- =============================================================================

-- Helper: is a given date a business day?
CREATE OR REPLACE FUNCTION is_business_day(
  p_date date,
  p_tz text DEFAULT 'America/New_York'
)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    EXTRACT(DOW FROM p_date) NOT IN (0, 6)  -- not Sat/Sun
    AND NOT EXISTS (
      SELECT 1 FROM us_federal_holidays WHERE holiday_date = p_date
    );
$$;

-- Replace the IMMUTABLE next_business_day_deadline with STABLE (uses holiday table now)
CREATE OR REPLACE FUNCTION next_business_day_deadline(
  p_start timestamptz,
  p_days integer DEFAULT 2,
  p_tz text DEFAULT 'America/New_York'
)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_date date;
  v_days_counted integer := 0;
  v_deadline_time time := '17:00:00';
BEGIN
  -- Start from the local date of the submission
  v_date := (p_start AT TIME ZONE p_tz)::date;

  -- If submitted after 5pm on a business day, that day doesn't count
  -- (already handled by advancing to next business day below)

  WHILE v_days_counted < p_days LOOP
    v_date := v_date + 1;
    IF is_business_day(v_date, p_tz) THEN
      v_days_counted := v_days_counted + 1;
    END IF;
  END LOOP;

  -- Return 5pm ET on the computed business day
  RETURN (v_date::text || ' 17:00:00')::timestamp AT TIME ZONE p_tz;
END;
$$;

-- Drop the old trigger that set ack_deadline; recreate it since the function signature is the same
-- (trigger already exists; just ensure it references the updated function)
-- No change needed — trigger calls next_business_day_deadline() which is now updated.

-- =============================================================================
-- 3. NEW COLUMNS ON connection_requests
-- =============================================================================

-- Response and assignment
ALTER TABLE connection_requests
  ADD COLUMN IF NOT EXISTS response_text text,
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS last_substantive_at timestamptz,
  ADD COLUMN IF NOT EXISTS inactivity_deadline timestamptz,
  ADD COLUMN IF NOT EXISTS is_inactivity_flagged boolean NOT NULL DEFAULT false;

-- Collaboration support
ALTER TABLE connection_requests
  ADD COLUMN IF NOT EXISTS parent_request_id uuid REFERENCES connection_requests(id),
  ADD COLUMN IF NOT EXISTS is_collaboration boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES locations(id);

-- Unable to assist
ALTER TABLE connection_requests
  ADD COLUMN IF NOT EXISTS unable_to_assist_category text
    CHECK (unable_to_assist_category IN (
      'capacity_no_availability',
      'eligibility',
      'service_not_offered',
      'outside_service_area',
      'temporarily_unavailable',
      'other'
    )),
  ADD COLUMN IF NOT EXISTS unable_to_assist_note text;

-- Closure
ALTER TABLE connection_requests
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS closure_type text
    CHECK (closure_type IN ('fulfilled', 'no_longer_needed', 'unable_to_fulfill', 'admin_abandoned', 'admin_duplicate')),
  ADD COLUMN IF NOT EXISTS closure_reason text,
  ADD COLUMN IF NOT EXISTS closure_notification_sent boolean NOT NULL DEFAULT false;

-- Reopen
ALTER TABLE connection_requests
  ADD COLUMN IF NOT EXISTS reopened_at timestamptz,
  ADD COLUMN IF NOT EXISTS reopen_note text,
  ADD COLUMN IF NOT EXISTS reopen_count integer NOT NULL DEFAULT 0;

-- Content flagging
ALTER TABLE connection_requests
  ADD COLUMN IF NOT EXISTS flagged_at timestamptz,
  ADD COLUMN IF NOT EXISTS flag_reason text,
  ADD COLUMN IF NOT EXISTS flag_reporter_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS is_content_restricted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS restriction_reason text,
  ADD COLUMN IF NOT EXISTS reconsideration_requested_at timestamptz;

-- Indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_cr_assigned_to ON connection_requests(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cr_parent_request ON connection_requests(parent_request_id) WHERE parent_request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cr_inactivity_flag ON connection_requests(is_inactivity_flagged) WHERE is_inactivity_flagged = true;
CREATE INDEX IF NOT EXISTS idx_cr_target_org ON connection_requests(target_organization_id);

-- Set inactivity_deadline for existing open requests that don't have one
-- (use 7 business days from created_at)
UPDATE connection_requests
SET inactivity_deadline = (
  SELECT next_business_day_deadline(created_at, 7)
)
WHERE inactivity_deadline IS NULL
  AND status NOT IN ('resolved', 'closed')
  AND closed_at IS NULL;

-- =============================================================================
-- 4. FUNCTION: submit_request_response
-- Assigned staff or POC submits a substantive in-platform response.
-- =============================================================================

CREATE OR REPLACE FUNCTION submit_request_response(
  p_request_id uuid,
  p_response_text text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request connection_requests%ROWTYPE;
  v_caller_org_id uuid;
BEGIN
  IF p_response_text IS NULL OR trim(p_response_text) = '' THEN
    RAISE EXCEPTION 'Response text is required';
  END IF;

  SELECT * INTO v_request FROM connection_requests WHERE id = p_request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF v_request.closed_at IS NOT NULL THEN RAISE EXCEPTION 'Cannot respond to a closed request'; END IF;

  -- Caller must be assigned staff or a member of target org
  SELECT om.org_id INTO v_caller_org_id
  FROM org_members om
  WHERE om.user_id = auth.uid()
    AND om.org_id = v_request.target_organization_id
    AND om.status = 'active'
  LIMIT 1;

  IF v_caller_org_id IS NULL THEN
    -- Allow admin override
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
      RAISE EXCEPTION 'Not authorized to respond to this request';
    END IF;
  END IF;

  UPDATE connection_requests
  SET
    response_text = p_response_text,
    last_substantive_at = now(),
    -- Reset inactivity: 7 business days from this substantive update
    inactivity_deadline = next_business_day_deadline(now(), 7),
    is_inactivity_flagged = false,
    updated_at = now()
  WHERE id = p_request_id;
END;
$$;

-- =============================================================================
-- 5. FUNCTION: mark_unable_to_assist
-- POC-only. Requires category + explanatory note.
-- =============================================================================

CREATE OR REPLACE FUNCTION mark_unable_to_assist(
  p_request_id uuid,
  p_category text,
  p_note text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request connection_requests%ROWTYPE;
  v_valid_categories text[] := ARRAY[
    'capacity_no_availability', 'eligibility', 'service_not_offered',
    'outside_service_area', 'temporarily_unavailable', 'other'
  ];
BEGIN
  IF p_category IS NULL OR p_category NOT IN (SELECT unnest(v_valid_categories)) THEN
    RAISE EXCEPTION 'Valid category required: %', array_to_string(v_valid_categories, ', ');
  END IF;
  IF p_note IS NULL OR trim(p_note) = '' THEN
    RAISE EXCEPTION 'Explanatory note is required when marking unable to assist';
  END IF;

  SELECT * INTO v_request FROM connection_requests WHERE id = p_request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF v_request.closed_at IS NOT NULL THEN RAISE EXCEPTION 'Request is already closed'; END IF;

  -- Only the receiving location POC may mark unable to assist
  IF NOT EXISTS (
    SELECT 1 FROM org_members om
    WHERE om.user_id = auth.uid()
      AND om.org_id = v_request.target_organization_id
      AND om.role = 'org_admin'
      AND om.status = 'active'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
      RAISE EXCEPTION 'Only the receiving location POC may mark a request unable to assist';
    END IF;
  END IF;

  UPDATE connection_requests
  SET
    unable_to_assist_category = p_category,
    unable_to_assist_note = p_note,
    status = 'resolved',
    updated_at = now()
  WHERE id = p_request_id;
END;
$$;

-- =============================================================================
-- 6. FUNCTION: assign_request
-- POC assigns a staff member to a request.
-- =============================================================================

CREATE OR REPLACE FUNCTION assign_request(
  p_request_id uuid,
  p_assignee_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request connection_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_request FROM connection_requests WHERE id = p_request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF v_request.closed_at IS NOT NULL THEN RAISE EXCEPTION 'Cannot assign a closed request'; END IF;

  -- Only POC or admin may assign
  IF NOT EXISTS (
    SELECT 1 FROM org_members om
    WHERE om.user_id = auth.uid()
      AND om.org_id = v_request.target_organization_id
      AND om.role = 'org_admin'
      AND om.status = 'active'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
      RAISE EXCEPTION 'Only the receiving location POC may assign requests';
    END IF;
  END IF;

  -- Assignee must be an active member of the target org (if not null)
  IF p_assignee_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.user_id = p_assignee_id
        AND om.org_id = v_request.target_organization_id
        AND om.status = 'active'
    ) THEN
      RAISE EXCEPTION 'Assignee must be an active member of the receiving organization';
    END IF;
  END IF;

  -- Assignment never resets deadlines; preserve existing timing
  UPDATE connection_requests
  SET
    assigned_to = p_assignee_id,
    updated_at = now()
  WHERE id = p_request_id;
END;
$$;

-- =============================================================================
-- 7. FUNCTION: close_request
-- Original requester closes their own need; TSE admin can close any.
-- =============================================================================

CREATE OR REPLACE FUNCTION close_request(
  p_request_id uuid,
  p_closure_type text,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request connection_requests%ROWTYPE;
  v_is_admin boolean;
  v_valid_requester_types text[] := ARRAY['fulfilled', 'no_longer_needed', 'unable_to_fulfill'];
  v_valid_admin_types text[] := ARRAY['fulfilled', 'no_longer_needed', 'unable_to_fulfill', 'admin_abandoned', 'admin_duplicate'];
BEGIN
  SELECT * INTO v_request FROM connection_requests WHERE id = p_request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF v_request.closed_at IS NOT NULL THEN RAISE EXCEPTION 'Request is already closed'; END IF;

  v_is_admin := EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin');

  -- Check closure type validity based on caller role
  IF v_is_admin THEN
    IF p_closure_type NOT IN (SELECT unnest(v_valid_admin_types)) THEN
      RAISE EXCEPTION 'Invalid closure type for admin: %', p_closure_type;
    END IF;
    -- Admin closures of abandoned/duplicate require reason
    IF p_closure_type IN ('admin_abandoned', 'admin_duplicate') AND (p_reason IS NULL OR trim(p_reason) = '') THEN
      RAISE EXCEPTION 'Reason required for administrative closure';
    END IF;
  ELSE
    -- Must be from the requesting organization
    IF NOT EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.user_id = auth.uid()
        AND om.org_id = v_request.requesting_user_id::uuid  -- requesting user's org
      LIMIT 1
    ) THEN
      -- Check by direct user match
      IF v_request.requesting_user_id != auth.uid() THEN
        RAISE EXCEPTION 'Only the original requesting organization or TSE may close this request';
      END IF;
    END IF;
    IF p_closure_type NOT IN (SELECT unnest(v_valid_requester_types)) THEN
      RAISE EXCEPTION 'Invalid closure type: %', p_closure_type;
    END IF;
  END IF;

  UPDATE connection_requests
  SET
    status = 'resolved',
    closed_at = now(),
    closed_by = auth.uid(),
    closure_type = p_closure_type,
    closure_reason = p_reason,
    updated_at = now()
  WHERE id = p_request_id;
END;
$$;

-- =============================================================================
-- 8. FUNCTION: reopen_request
-- Original requester or TSE admin; within 30 calendar days of closure.
-- Does NOT auto-notify previous participants; does NOT require TSE pre-approval.
-- =============================================================================

CREATE OR REPLACE FUNCTION reopen_request(
  p_request_id uuid,
  p_reopen_note text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request connection_requests%ROWTYPE;
BEGIN
  IF p_reopen_note IS NULL OR trim(p_reopen_note) = '' THEN
    RAISE EXCEPTION 'A note is required when reopening a request';
  END IF;

  SELECT * INTO v_request FROM connection_requests WHERE id = p_request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF v_request.closed_at IS NULL THEN RAISE EXCEPTION 'Request is not closed'; END IF;

  -- 30-day reopen window
  IF now() > v_request.closed_at + interval '30 days' THEN
    RAISE EXCEPTION 'Reopen window has expired (30 calendar days from closure)';
  END IF;

  -- Only original requester or admin
  IF v_request.requesting_user_id != auth.uid() THEN
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
      RAISE EXCEPTION 'Only the original requester or TSE may reopen this request';
    END IF;
  END IF;

  -- Reopen: restore to pending, preserve all history, reset inactivity clock
  UPDATE connection_requests
  SET
    status = 'pending',
    closed_at = NULL,
    closed_by = NULL,
    closure_type = NULL,
    closure_reason = NULL,
    reopened_at = now(),
    reopen_note = p_reopen_note,
    reopen_count = reopen_count + 1,
    -- Reopen itself does NOT reset inactivity; fresh contacts sent later do
    updated_at = now()
  WHERE id = p_request_id;
END;
$$;

-- =============================================================================
-- 9. FUNCTION: get_incoming_connection_requests (updated with new fields)
-- =============================================================================

CREATE OR REPLACE FUNCTION get_incoming_connection_requests(p_org_id uuid)
RETURNS TABLE (
  id uuid,
  request_type text,
  notes text,
  status text,
  created_at timestamptz,
  ack_deadline timestamptz,
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  closure_type text,
  is_ack_overdue boolean,
  assigned_to uuid,
  is_inactivity_flagged boolean,
  inactivity_deadline timestamptz,
  unable_to_assist_category text,
  parent_request_id uuid,
  is_collaboration boolean,
  requester_name text,
  requester_email text,
  requester_org text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Caller must be a member of the target org or admin
  IF NOT EXISTS (
    SELECT 1 FROM org_members om
    WHERE om.user_id = auth.uid()
      AND om.org_id = p_org_id
      AND om.status = 'active'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
      RAISE EXCEPTION 'Not authorized';
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    cr.id,
    cr.request_type,
    cr.notes,
    cr.status,
    cr.created_at,
    cr.ack_deadline,
    cr.acknowledged_at,
    cr.resolved_at,
    cr.closed_at,
    cr.closure_type,
    (cr.ack_deadline IS NOT NULL
      AND cr.acknowledged_at IS NULL
      AND now() > cr.ack_deadline) AS is_ack_overdue,
    cr.assigned_to,
    cr.is_inactivity_flagged,
    cr.inactivity_deadline,
    cr.unable_to_assist_category,
    cr.parent_request_id,
    cr.is_collaboration,
    p.full_name AS requester_name,
    p.email AS requester_email,
    o.name AS requester_org
  FROM connection_requests cr
  LEFT JOIN profiles p ON p.id = cr.requesting_user_id
  LEFT JOIN org_members om_req ON om_req.user_id = cr.requesting_user_id AND om_req.status = 'active'
  LEFT JOIN organizations o ON o.id = om_req.org_id
  WHERE cr.target_organization_id = p_org_id
    AND cr.is_content_restricted = false
  ORDER BY cr.created_at DESC;
END;
$$;

-- =============================================================================
-- 10. FUNCTION: admin_get_connection_requests (updated with new fields)
-- =============================================================================

CREATE OR REPLACE FUNCTION admin_get_connection_requests(p_status text DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  request_type text,
  notes text,
  status text,
  created_at timestamptz,
  ack_deadline timestamptz,
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  closure_type text,
  is_ack_overdue boolean,
  assigned_to uuid,
  is_inactivity_flagged boolean,
  unable_to_assist_category text,
  unable_to_assist_note text,
  is_content_restricted boolean,
  reopen_count integer,
  requester_name text,
  requester_org text,
  target_org text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  RETURN QUERY
  SELECT
    cr.id,
    cr.request_type,
    cr.notes,
    cr.status,
    cr.created_at,
    cr.ack_deadline,
    cr.acknowledged_at,
    cr.resolved_at,
    cr.closed_at,
    cr.closure_type,
    (cr.ack_deadline IS NOT NULL
      AND cr.acknowledged_at IS NULL
      AND now() > cr.ack_deadline) AS is_ack_overdue,
    cr.assigned_to,
    cr.is_inactivity_flagged,
    cr.unable_to_assist_category,
    cr.unable_to_assist_note,
    cr.is_content_restricted,
    cr.reopen_count,
    p.full_name AS requester_name,
    req_org.name AS requester_org,
    tgt_org.name AS target_org
  FROM connection_requests cr
  LEFT JOIN profiles p ON p.id = cr.requesting_user_id
  LEFT JOIN org_members om_req ON om_req.user_id = cr.requesting_user_id AND om_req.status = 'active'
  LEFT JOIN organizations req_org ON req_org.id = om_req.org_id
  LEFT JOIN organizations tgt_org ON tgt_org.id = cr.target_organization_id
  WHERE (p_status IS NULL OR cr.status = p_status)
  ORDER BY
    cr.is_inactivity_flagged DESC,
    cr.ack_deadline ASC NULLS LAST,
    cr.created_at DESC;
END;
$$;

-- =============================================================================
-- 11. TRIGGER: set inactivity_deadline on new connection_requests
-- =============================================================================

CREATE OR REPLACE FUNCTION trg_set_inactivity_deadline_fn()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- 7 business days from creation for inactivity tracking
  IF NEW.inactivity_deadline IS NULL THEN
    NEW.inactivity_deadline := next_business_day_deadline(NEW.created_at, 7);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_inactivity_deadline ON connection_requests;
CREATE TRIGGER trg_set_inactivity_deadline
  BEFORE INSERT ON connection_requests
  FOR EACH ROW EXECUTE FUNCTION trg_set_inactivity_deadline_fn();

-- =============================================================================
-- 12. FUNCTION: check_inactivity_flags (TSE admin — flag overdue requests)
-- Called periodically or on-demand; idempotent; never creates duplicates.
-- =============================================================================

CREATE OR REPLACE FUNCTION admin_check_inactivity_flags()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_flagged integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  UPDATE connection_requests
  SET
    is_inactivity_flagged = true,
    status = CASE WHEN status = 'pending' THEN 'pending' ELSE status END,
    updated_at = now()
  WHERE
    closed_at IS NULL
    AND is_inactivity_flagged = false
    AND inactivity_deadline IS NOT NULL
    AND now() > inactivity_deadline
    -- No substantive update restarted the clock
    AND (last_substantive_at IS NULL OR now() > last_substantive_at + interval '7 days');

  GET DIAGNOSTICS v_flagged = ROW_COUNT;
  RETURN v_flagged;
END;
$$;

-- =============================================================================
-- 13. Level-based service allowance correction
-- Phase 9 set test values: 12/6/4, 24/12/8, 0/0/0 — not approved.
-- Approved per-location annual quantities:
--   Level 1 (first upgrade):  2 reviews / 0 intros / 0 sessions
--   Level 2 (second upgrade): 2 reviews / 4 intros / 0 sessions
--   Level 3 (highest):        2 reviews / 4 intros / 2 sessions
--
-- Tier → level mapping is a FOUNDER DEPENDENCY (see below).
-- We introduce a benefit_levels table for configurable mapping.
-- billing_config is NOT updated blindly — existing service_allowance rows
-- for real members are preserved. Only future enrollments use correct values.
-- =============================================================================

CREATE TABLE IF NOT EXISTS benefit_levels (
  id integer PRIMARY KEY,
  level_name text NOT NULL,
  annual_request_reviews integer NOT NULL DEFAULT 0,
  annual_curated_intros integer NOT NULL DEFAULT 0,
  annual_facilitated_sessions integer NOT NULL DEFAULT 0,
  description text
);

INSERT INTO benefit_levels (id, level_name, annual_request_reviews, annual_curated_intros, annual_facilitated_sessions, description)
VALUES
  (1, 'First upgrade',  2, 0, 0, '2 request reviews per location per year'),
  (2, 'Second upgrade', 2, 4, 0, '2 reviews + 4 introductions per location per year'),
  (3, 'Highest level',  2, 4, 2, '2 reviews + 4 introductions + 2 sessions per location per year')
ON CONFLICT (id) DO UPDATE SET
  annual_request_reviews    = EXCLUDED.annual_request_reviews,
  annual_curated_intros     = EXCLUDED.annual_curated_intros,
  annual_facilitated_sessions = EXCLUDED.annual_facilitated_sessions;

-- Add benefit_level_id FK to billing_config for future mapping
ALTER TABLE billing_config
  ADD COLUMN IF NOT EXISTS benefit_level_id integer REFERENCES benefit_levels(id);

-- NOTE: benefit_level_id is intentionally left NULL until the founder confirms
-- which tier maps to which level. See FOUNDER DEPENDENCY below.
-- The existing annual_request_reviews/curated_intros/facilitated_sessions columns
-- are preserved; they will be overridden by benefit_levels once mapping is confirmed.

COMMENT ON COLUMN billing_config.annual_request_reviews IS
  '[TEST VALUES — not approved for production. Use benefit_level_id mapping once tier→level confirmed by founder.]';
COMMENT ON COLUMN billing_config.annual_curated_intros IS
  '[TEST VALUES — not approved for production. Use benefit_level_id mapping once tier→level confirmed by founder.]';
COMMENT ON COLUMN billing_config.annual_facilitated_sessions IS
  '[TEST VALUES — not approved for production. Use benefit_level_id mapping once tier→level confirmed by founder.]';

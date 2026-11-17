-- Phase 11: POC/leadership role enforcement + Sunday reminder config
--
-- Role hierarchy in org_members.role:
--   org_admin  = Location POC — owns incoming requests, delegates, marks unable-to-assist,
--                manages listing changes, closes on behalf of org
--   member     = Assigned staff — responds, invites collaborators; one assignee per request
--   leadership = Read-only oversight across authorized org locations; may confirm weekly
--                and act as POC substitute only when explicitly covering an unavailable POC
--
-- Owners (organizations.user_id) retain full POC-equivalent access regardless of role.
-- TSE admins (profiles.role = 'admin') retain global override throughout.

-- =============================================================================
-- 1. Add CHECK constraint to org_members.role
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'org_members_role_check'
      AND table_name = 'org_members'
  ) THEN
    ALTER TABLE org_members
      ADD CONSTRAINT org_members_role_check
      CHECK (role IN ('org_admin', 'member', 'leadership'));
  END IF;
END $$;

-- =============================================================================
-- 2. location_leadership — multi-location read access + POC-coverage flag
--    leadership members are org_members with role='leadership'; this table
--    records which additional locations they can oversee beyond their home one.
--    is_covering: set by org owner/POC when leadership is actively covering
--    an unavailable POC; unset when POC returns.
-- =============================================================================

CREATE TABLE IF NOT EXISTS location_leadership (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  location_id  uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  granted_by   uuid REFERENCES profiles(id),
  is_covering  boolean NOT NULL DEFAULT false,
  granted_at   timestamptz NOT NULL DEFAULT now(),
  revoked_at   timestamptz,
  UNIQUE (user_id, location_id)
);

CREATE INDEX IF NOT EXISTS idx_location_leadership_user   ON location_leadership(user_id);
CREATE INDEX IF NOT EXISTS idx_location_leadership_loc    ON location_leadership(location_id);
CREATE INDEX IF NOT EXISTS idx_location_leadership_org    ON location_leadership(org_id);

-- RLS: org members and org owners can read; write only via SECURITY DEFINER RPCs
ALTER TABLE location_leadership ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leadership read own" ON location_leadership;
CREATE POLICY "leadership read own" ON location_leadership
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM organizations o
      WHERE o.id = org_id AND o.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- =============================================================================
-- 3. Helper: is_location_poc(p_user_id, p_org_id)
--    Returns true if the user is the org owner or has role='org_admin'.
-- =============================================================================

CREATE OR REPLACE FUNCTION is_location_poc(p_user_id uuid, p_org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM organizations o WHERE o.id = p_org_id AND o.user_id = p_user_id
  ) OR EXISTS (
    SELECT 1 FROM org_members om
    WHERE om.user_id = p_user_id
      AND om.org_id = p_org_id
      AND om.role = 'org_admin'
      AND om.status = 'active'
  ) OR EXISTS (
    SELECT 1 FROM user_roles ur WHERE ur.user_id = p_user_id AND ur.role = 'admin'
  );
$$;

-- =============================================================================
-- 4. Helper: is_active_staff(p_user_id, p_org_id)
--    Returns true for org_admin, member, or org owner — anyone who can act.
-- =============================================================================

CREATE OR REPLACE FUNCTION is_active_staff(p_user_id uuid, p_org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM organizations o WHERE o.id = p_org_id AND o.user_id = p_user_id
  ) OR EXISTS (
    SELECT 1 FROM org_members om
    WHERE om.user_id = p_user_id
      AND om.org_id = p_org_id
      AND om.role IN ('org_admin', 'member')
      AND om.status = 'active'
  );
$$;

-- =============================================================================
-- 5. Helper: is_leadership_covering(p_user_id, p_location_id)
--    Returns true when a leadership member is actively covering a POC.
-- =============================================================================

CREATE OR REPLACE FUNCTION is_leadership_covering(p_user_id uuid, p_location_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM location_leadership ll
    WHERE ll.user_id = p_user_id
      AND ll.location_id = p_location_id
      AND ll.is_covering = true
      AND ll.revoked_at IS NULL
  );
$$;

-- =============================================================================
-- 6. grant_leadership_access — org owner or TSE admin grants leadership access
-- =============================================================================

CREATE OR REPLACE FUNCTION grant_leadership_access(
  p_user_id     uuid,
  p_location_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  SELECT org_id INTO v_org_id FROM locations WHERE id = p_location_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Location not found'; END IF;

  -- Only org owner or TSE admin
  IF NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = v_org_id AND o.user_id = auth.uid()) THEN
    IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
      RAISE EXCEPTION 'Only the organization owner or TSE may grant leadership access';
    END IF;
  END IF;

  -- Target user must be an active member with role='leadership'
  IF NOT EXISTS (
    SELECT 1 FROM org_members om
    WHERE om.user_id = p_user_id AND om.org_id = v_org_id
      AND om.role = 'leadership' AND om.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Target user must be an active leadership member of this organization';
  END IF;

  INSERT INTO location_leadership (org_id, user_id, location_id, granted_by)
  VALUES (v_org_id, p_user_id, p_location_id, auth.uid())
  ON CONFLICT (user_id, location_id) DO UPDATE
    SET revoked_at = NULL, granted_by = auth.uid(), granted_at = now();
END;
$$;

-- =============================================================================
-- 7. revoke_leadership_access — org owner or TSE admin revokes
-- =============================================================================

CREATE OR REPLACE FUNCTION revoke_leadership_access(
  p_user_id     uuid,
  p_location_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  SELECT org_id INTO v_org_id FROM locations WHERE id = p_location_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Location not found'; END IF;

  IF NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = v_org_id AND o.user_id = auth.uid()) THEN
    IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
      RAISE EXCEPTION 'Only the organization owner or TSE may revoke leadership access';
    END IF;
  END IF;

  UPDATE location_leadership
  SET revoked_at = now(), is_covering = false
  WHERE user_id = p_user_id AND location_id = p_location_id AND revoked_at IS NULL;
END;
$$;

-- =============================================================================
-- 8. set_leadership_covering — toggle POC-coverage for a leadership member
-- =============================================================================

CREATE OR REPLACE FUNCTION set_leadership_covering(
  p_user_id     uuid,
  p_location_id uuid,
  p_covering    boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  SELECT org_id INTO v_org_id FROM locations WHERE id = p_location_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Location not found'; END IF;

  IF NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = v_org_id AND o.user_id = auth.uid()) THEN
    IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
      RAISE EXCEPTION 'Only the organization owner or TSE may set covering status';
    END IF;
  END IF;

  UPDATE location_leadership
  SET is_covering = p_covering
  WHERE user_id = p_user_id AND location_id = p_location_id AND revoked_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active leadership grant found for this user and location';
  END IF;
END;
$$;

-- =============================================================================
-- 9. Update mark_unable_to_assist — allow leadership when covering
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

  -- POC, org owner, or leadership actively covering
  IF NOT is_location_poc(auth.uid(), v_request.target_organization_id) THEN
    -- Check leadership covering this specific location
    IF NOT (
      v_request.location_id IS NOT NULL
      AND is_leadership_covering(auth.uid(), v_request.location_id)
    ) THEN
      IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
        RAISE EXCEPTION 'Only the receiving location POC (or covering leadership) may mark a request unable to assist';
      END IF;
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
-- 10. Update assign_request — POC-only; leadership may assign only when covering
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

  -- POC, or leadership covering this location
  IF NOT is_location_poc(auth.uid(), v_request.target_organization_id) THEN
    IF NOT (
      v_request.location_id IS NOT NULL
      AND is_leadership_covering(auth.uid(), v_request.location_id)
    ) THEN
      IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
        RAISE EXCEPTION 'Only the receiving location POC (or covering leadership) may assign requests';
      END IF;
    END IF;
  END IF;

  -- Assignee must be active POC or staff (not leadership-only) of the target org
  IF p_assignee_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.user_id = p_assignee_id
        AND om.org_id = v_request.target_organization_id
        AND om.role IN ('org_admin', 'member')
        AND om.status = 'active'
    ) THEN
      -- Allow org owner
      IF NOT EXISTS (
        SELECT 1 FROM organizations o
        WHERE o.id = v_request.target_organization_id AND o.user_id = p_assignee_id
      ) THEN
        RAISE EXCEPTION 'Assignee must be an active POC or staff member of the receiving organization';
      END IF;
    END IF;
  END IF;

  UPDATE connection_requests
  SET assigned_to = p_assignee_id, updated_at = now()
  WHERE id = p_request_id;
END;
$$;

-- =============================================================================
-- 11. Update get_org_staff — include leadership, label roles
-- =============================================================================

DROP FUNCTION IF EXISTS get_org_staff(uuid);

CREATE FUNCTION get_org_staff(p_org_id uuid)
RETURNS TABLE (
  user_id   uuid,
  full_name text,
  role      text,
  role_label text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_active_staff(auth.uid(), p_org_id) THEN
    IF NOT EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.user_id = auth.uid() AND om.org_id = p_org_id
        AND om.role = 'leadership' AND om.status = 'active'
    ) THEN
      IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
        RAISE EXCEPTION 'Not authorized';
      END IF;
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    om.user_id,
    p.full_name,
    om.role,
    CASE om.role
      WHEN 'org_admin'  THEN 'Location POC'
      WHEN 'member'     THEN 'Staff'
      WHEN 'leadership' THEN 'Leadership'
      ELSE om.role
    END AS role_label
  FROM org_members om
  JOIN profiles p ON p.id = om.user_id
  WHERE om.org_id = p_org_id
    AND om.status = 'active'
  ORDER BY
    CASE om.role WHEN 'org_admin' THEN 1 WHEN 'member' THEN 2 WHEN 'leadership' THEN 3 ELSE 4 END,
    p.full_name;
END;
$$;

-- =============================================================================
-- 12. Update get_incoming_connection_requests — include leadership-authorized locs
-- =============================================================================

DROP FUNCTION IF EXISTS get_incoming_connection_requests(uuid);

CREATE FUNCTION get_incoming_connection_requests(p_org_id uuid)
RETURNS TABLE (
  id                      uuid,
  request_type            text,
  notes                   text,
  status                  text,
  created_at              timestamptz,
  ack_deadline            timestamptz,
  acknowledged_at         timestamptz,
  resolved_at             timestamptz,
  closed_at               timestamptz,
  closure_type            text,
  is_ack_overdue          boolean,
  assigned_to             uuid,
  is_inactivity_flagged   boolean,
  inactivity_deadline     timestamptz,
  unable_to_assist_category text,
  parent_request_id       uuid,
  is_collaboration        boolean,
  requester_name          text,
  requester_email         text,
  requester_org           text,
  flagged_at              timestamptz,
  is_content_restricted   boolean,
  -- Phase 11: viewer's effective role for this request
  viewer_role             text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_is_poc   boolean;
BEGIN
  v_is_admin := EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin');
  v_is_poc   := is_location_poc(auth.uid(), p_org_id);

  -- Must be active staff, leadership member, or admin
  IF NOT v_is_admin AND NOT is_active_staff(auth.uid(), p_org_id) THEN
    IF NOT EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.user_id = auth.uid() AND om.org_id = p_org_id
        AND om.role = 'leadership' AND om.status = 'active'
    ) THEN
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
    COALESCE(cr.is_inactivity_flagged, false),
    cr.inactivity_deadline,
    cr.unable_to_assist_category,
    cr.parent_request_id,
    COALESCE(cr.is_collaboration, false),
    p.full_name AS requester_name,
    NULL::text  AS requester_email,
    o.name      AS requester_org,
    cr.flagged_at,
    COALESCE(cr.is_content_restricted, false),
    -- Effective viewer role for this request
    CASE
      WHEN v_is_admin THEN 'admin'
      WHEN v_is_poc   THEN 'poc'
      WHEN EXISTS (
        SELECT 1 FROM org_members om
        WHERE om.user_id = auth.uid() AND om.org_id = p_org_id
          AND om.role = 'member' AND om.status = 'active'
      ) THEN 'staff'
      ELSE 'leadership'
    END AS viewer_role
  FROM connection_requests cr
  LEFT JOIN profiles p ON p.id = cr.requesting_user_id
  LEFT JOIN org_members om_req ON om_req.user_id = cr.requesting_user_id AND om_req.status = 'active'
  LEFT JOIN organizations o ON o.id = om_req.org_id
  WHERE cr.target_organization_id = p_org_id
    AND (cr.is_content_restricted IS NULL OR cr.is_content_restricted = false)
  ORDER BY cr.created_at DESC;
END;
$$;

-- =============================================================================
-- 13. get_leadership_locations — read-only view of locations a leadership
--     member can oversee (used to populate their oversight panel)
-- =============================================================================

CREATE OR REPLACE FUNCTION get_leadership_locations(p_user_id uuid DEFAULT NULL)
RETURNS TABLE (
  location_id    uuid,
  location_name  text,
  org_id         uuid,
  org_name       text,
  is_covering    boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target uuid := COALESCE(p_user_id, auth.uid());
BEGIN
  -- Can only query self unless admin
  IF v_target != auth.uid() THEN
    IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
      RAISE EXCEPTION 'Not authorized';
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    l.id  AS location_id,
    l.name AS location_name,
    o.id  AS org_id,
    o.name AS org_name,
    ll.is_covering
  FROM location_leadership ll
  JOIN locations l ON l.id = ll.location_id
  JOIN organizations o ON o.id = ll.org_id
  WHERE ll.user_id = v_target
    AND ll.revoked_at IS NULL
  ORDER BY o.name, l.name;
END;
$$;

-- =============================================================================
-- 14. reminder_schedule — Sunday 5 p.m. America/New_York (delivery disabled)
--     DST is handled by the America/New_York timezone: the cron fires at the
--     wall-clock time 17:00 ET year-round, which shifts between UTC 21:00
--     (EDT, Mar–Nov) and UTC 22:00 (EST, Nov–Mar) automatically when
--     scheduled via pg_cron with AT TIME ZONE semantics or a TZ-aware agent.
-- =============================================================================

CREATE TABLE IF NOT EXISTS reminder_schedule (
  id              text PRIMARY KEY,
  schedule_cron   text NOT NULL,         -- cron expression (UTC equivalent stored for reference)
  timezone        text NOT NULL,         -- canonical tz for display / DST math
  wall_clock_time text NOT NULL,         -- human-readable: "5:00 PM"
  day_of_week     text NOT NULL,         -- "Sunday"
  delivery_enabled boolean NOT NULL DEFAULT false,  -- DISABLED until founder enables
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Upsert the Sunday 5 pm ET schedule (delivery_enabled = false)
INSERT INTO reminder_schedule (id, schedule_cron, timezone, wall_clock_time, day_of_week, delivery_enabled)
VALUES (
  'weekly_digest',
  '0 17 * * 0',          -- 17:00 wall clock, Sunday; real UTC offset managed by scheduler TZ
  'America/New_York',    -- DST-aware: EDT (UTC-4) Mar–Nov, EST (UTC-5) Nov–Mar
  '5:00 PM',
  'Sunday',
  false                  -- DELIVERY DISABLED — do not enable without founder authorization
)
ON CONFLICT (id) DO UPDATE
  SET
    schedule_cron   = EXCLUDED.schedule_cron,
    timezone        = EXCLUDED.timezone,
    wall_clock_time = EXCLUDED.wall_clock_time,
    day_of_week     = EXCLUDED.day_of_week,
    -- Preserve delivery_enabled — never flip it here
    updated_at      = now();

-- Phase 10e: Content flagging RPCs + TSE weekly review
-- Reporter identity is restricted to TSE admin-only views — never exposed in
-- provider-facing results, notifications, or exports.

-- =============================================================================
-- 1. flag_request — any authenticated user may flag a request
--    Records flag; reporter identity stays server-side only.
-- =============================================================================

CREATE OR REPLACE FUNCTION flag_request(
  p_request_id uuid,
  p_reason     text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'A flag reason is required';
  END IF;

  -- Only unflagged, non-restricted requests can be flagged
  UPDATE connection_requests
  SET
    flagged_at         = now(),
    flag_reason        = trim(p_reason),
    flag_reporter_id   = auth.uid()
  WHERE id = p_request_id
    AND flagged_at IS NULL
    AND is_content_restricted IS NOT TRUE;

  IF NOT FOUND THEN
    -- Either already flagged, restricted, or doesn't exist — treat as no-op
    RETURN;
  END IF;
END;
$$;

-- =============================================================================
-- 2. admin_restrict_content — TSE admin restricts content on a request
-- =============================================================================

CREATE OR REPLACE FUNCTION admin_restrict_content(
  p_request_id      uuid,
  p_restriction_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF p_restriction_reason IS NULL OR trim(p_restriction_reason) = '' THEN
    RAISE EXCEPTION 'A restriction reason is required';
  END IF;

  UPDATE connection_requests
  SET
    is_content_restricted = true,
    restriction_reason    = trim(p_restriction_reason)
  WHERE id = p_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;
END;
$$;

-- =============================================================================
-- 3. admin_lift_restriction — TSE admin lifts content restriction
-- =============================================================================

CREATE OR REPLACE FUNCTION admin_lift_restriction(
  p_request_id uuid,
  p_note       text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  UPDATE connection_requests
  SET
    is_content_restricted          = false,
    restriction_reason             = NULL,
    reconsideration_requested_at   = NULL
  WHERE id = p_request_id
    AND is_content_restricted = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found or not currently restricted';
  END IF;
END;
$$;

-- =============================================================================
-- 4. admin_get_weekly_review — TSE weekly review panel
--    Returns:
--      a) flagged requests pending TSE action (not yet restricted/cleared)
--      b) unable-to-assist cases from last 30 days
--      c) inactivity-flagged open requests
--    Reporter identity included here (TSE admin only).
-- =============================================================================

CREATE OR REPLACE FUNCTION admin_get_weekly_review()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_since timestamptz := now() - interval '30 days';
  v_result jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT jsonb_build_object(
    'generated_at', now(),

    -- Flagged, not yet actioned (not restricted, not cleared)
    'pending_flags', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id',               cr.id,
          'created_at',       cr.created_at,
          'flagged_at',       cr.flagged_at,
          'flag_reason',      cr.flag_reason,
          'reporter_name',    p.full_name,
          'notes',            cr.notes,
          'status',           cr.status,
          'target_org_name',  o.name,
          'requester_name',   rp.full_name
        )
        ORDER BY cr.flagged_at DESC
      )
      FROM connection_requests cr
      LEFT JOIN profiles p  ON p.id  = cr.flag_reporter_id
      LEFT JOIN organizations o ON o.id = cr.target_organization_id
      LEFT JOIN profiles rp ON rp.id = cr.requesting_user_id
      WHERE cr.flagged_at IS NOT NULL
        AND (cr.is_content_restricted IS NULL OR cr.is_content_restricted = false)
    ),

    -- Recently restricted content
    'restricted_content', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id',                 cr.id,
          'created_at',         cr.created_at,
          'flagged_at',         cr.flagged_at,
          'restriction_reason', cr.restriction_reason,
          'reconsideration_requested_at', cr.reconsideration_requested_at,
          'notes',              cr.notes,
          'status',             cr.status,
          'target_org_name',    o.name,
          'requester_name',     rp.full_name
        )
        ORDER BY cr.flagged_at DESC NULLS LAST
      )
      FROM connection_requests cr
      LEFT JOIN organizations o ON o.id = cr.target_organization_id
      LEFT JOIN profiles rp ON rp.id = cr.requesting_user_id
      WHERE cr.is_content_restricted = true
      LIMIT 100
    ),

    -- Unable to assist cases last 30 days
    'unable_to_assist', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id',                       cr.id,
          'created_at',               cr.created_at,
          'unable_to_assist_category', cr.unable_to_assist_category,
          'unable_to_assist_note',    cr.unable_to_assist_note,
          'notes',                    cr.notes,
          'target_org_name',          o.name,
          'requester_name',           rp.full_name
        )
        ORDER BY cr.created_at DESC
      )
      FROM connection_requests cr
      LEFT JOIN organizations o ON o.id = cr.target_organization_id
      LEFT JOIN profiles rp ON rp.id = cr.requesting_user_id
      WHERE cr.unable_to_assist_category IS NOT NULL
        AND cr.created_at >= v_since
    ),

    -- Inactivity-flagged open requests
    'inactivity_flagged', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id',                 cr.id,
          'created_at',         cr.created_at,
          'inactivity_deadline', cr.inactivity_deadline,
          'notes',              cr.notes,
          'status',             cr.status,
          'target_org_name',    o.name,
          'requester_name',     rp.full_name,
          'assigned_to',        cr.assigned_to,
          'assignee_name',      ap.full_name
        )
        ORDER BY cr.inactivity_deadline ASC NULLS LAST
      )
      FROM connection_requests cr
      LEFT JOIN organizations o ON o.id = cr.target_organization_id
      LEFT JOIN profiles rp ON rp.id = cr.requesting_user_id
      LEFT JOIN profiles ap ON ap.id::text = cr.assigned_to
      WHERE cr.is_inactivity_flagged = true
        AND cr.closed_at IS NULL
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- =============================================================================
-- 5. admin_get_connection_requests: add content flagging fields to return
-- =============================================================================

-- Drop first to change return shape
DROP FUNCTION IF EXISTS admin_get_connection_requests();

CREATE FUNCTION admin_get_connection_requests()
RETURNS TABLE (
  id                      uuid,
  notes                   text,
  status                  text,
  created_at              timestamptz,
  request_type            text,
  ack_deadline            timestamptz,
  acknowledged_at         timestamptz,
  resolved_at             timestamptz,
  is_ack_overdue          boolean,
  target_org_id           uuid,
  target_org_name         text,
  requester_name          text,
  requester_email         text,
  -- Phase 10 additions
  assigned_to             text,
  is_inactivity_flagged   boolean,
  inactivity_deadline     timestamptz,
  unable_to_assist_category text,
  unable_to_assist_note   text,
  closed_at               timestamptz,
  closure_type            text,
  is_collaboration        boolean,
  parent_request_id       uuid,
  -- Phase 10e additions
  flagged_at              timestamptz,
  flag_reason             text,
  is_content_restricted   boolean,
  restriction_reason      text,
  reconsideration_requested_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN QUERY
  SELECT
    cr.id,
    cr.notes,
    cr.status,
    cr.created_at,
    cr.request_type,
    cr.ack_deadline,
    cr.acknowledged_at,
    cr.resolved_at,
    (cr.acknowledged_at IS NULL AND cr.ack_deadline IS NOT NULL AND now() > cr.ack_deadline AND cr.closed_at IS NULL) AS is_ack_overdue,
    cr.target_organization_id,
    o.name,
    p.full_name,
    NULL::text,   -- no email in profiles
    cr.assigned_to,
    COALESCE(cr.is_inactivity_flagged, false),
    cr.inactivity_deadline,
    cr.unable_to_assist_category,
    cr.unable_to_assist_note,
    cr.closed_at,
    cr.closure_type,
    COALESCE(cr.is_collaboration, false),
    cr.parent_request_id,
    cr.flagged_at,
    cr.flag_reason,
    COALESCE(cr.is_content_restricted, false),
    cr.restriction_reason,
    cr.reconsideration_requested_at
  FROM connection_requests cr
  LEFT JOIN organizations o ON o.id = cr.target_organization_id
  LEFT JOIN profiles p ON p.id = cr.requesting_user_id
  ORDER BY cr.created_at DESC;
END;
$$;

-- =============================================================================
-- 6. Update get_incoming_connection_requests to expose flagged_at and
--    is_content_restricted so the provider UI can show flag status.
--    Restricted requests remain hidden (filtered out).
-- =============================================================================

DROP FUNCTION IF EXISTS get_incoming_connection_requests(uuid);

CREATE FUNCTION get_incoming_connection_requests(p_org_id uuid)
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
  requester_org text,
  flagged_at timestamptz,
  is_content_restricted boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
    COALESCE(cr.is_inactivity_flagged, false),
    cr.inactivity_deadline,
    cr.unable_to_assist_category,
    cr.parent_request_id,
    COALESCE(cr.is_collaboration, false),
    p.full_name AS requester_name,
    NULL::text AS requester_email,
    o.name AS requester_org,
    cr.flagged_at,
    COALESCE(cr.is_content_restricted, false)
  FROM connection_requests cr
  LEFT JOIN profiles p ON p.id = cr.requesting_user_id
  LEFT JOIN org_members om_req ON om_req.user_id = cr.requesting_user_id AND om_req.status = 'active'
  LEFT JOIN organizations o ON o.id = om_req.org_id
  WHERE cr.target_organization_id = p_org_id
    AND (cr.is_content_restricted IS NULL OR cr.is_content_restricted = false)
  ORDER BY cr.created_at DESC;
END;
$$;

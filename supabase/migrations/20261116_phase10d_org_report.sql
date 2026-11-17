-- Phase 10d: Organization performance report RPC
-- Provider users see only their own org's data.
-- Counts are for the specified reporting period (defaults to last 90 days).

CREATE OR REPLACE FUNCTION get_org_request_report(
  p_org_id uuid,
  p_days integer DEFAULT 90
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_since timestamptz;
  v_result jsonb;
BEGIN
  -- Caller must be a member of the org or admin
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

  v_since := now() - (p_days || ' days')::interval;

  SELECT jsonb_build_object(
    'period_days', p_days,
    'generated_at', now(),
    'timezone', 'America/New_York',

    -- Incoming requests received in period
    'total_incoming', (
      SELECT count(*) FROM connection_requests
      WHERE target_organization_id = p_org_id AND created_at >= v_since
    ),

    -- Acknowledgment performance
    'ack_on_time', (
      SELECT count(*) FROM connection_requests
      WHERE target_organization_id = p_org_id
        AND created_at >= v_since
        AND acknowledged_at IS NOT NULL
        AND ack_deadline IS NOT NULL
        AND acknowledged_at <= ack_deadline
    ),
    'ack_overdue', (
      SELECT count(*) FROM connection_requests
      WHERE target_organization_id = p_org_id
        AND created_at >= v_since
        AND acknowledged_at IS NULL
        AND ack_deadline IS NOT NULL
        AND now() > ack_deadline
        AND closed_at IS NULL
    ),
    'ack_pending', (
      SELECT count(*) FROM connection_requests
      WHERE target_organization_id = p_org_id
        AND created_at >= v_since
        AND acknowledged_at IS NULL
        AND (ack_deadline IS NULL OR now() <= ack_deadline)
        AND closed_at IS NULL
    ),

    -- Inactivity
    'flagged_inactivity', (
      SELECT count(*) FROM connection_requests
      WHERE target_organization_id = p_org_id
        AND created_at >= v_since
        AND is_inactivity_flagged = true
    ),

    -- Unable to assist breakdown
    'unable_to_assist_total', (
      SELECT count(*) FROM connection_requests
      WHERE target_organization_id = p_org_id
        AND created_at >= v_since
        AND unable_to_assist_category IS NOT NULL
    ),
    'unable_to_assist_by_category', (
      SELECT jsonb_object_agg(unable_to_assist_category, cnt)
      FROM (
        SELECT unable_to_assist_category, count(*) AS cnt
        FROM connection_requests
        WHERE target_organization_id = p_org_id
          AND created_at >= v_since
          AND unable_to_assist_category IS NOT NULL
        GROUP BY unable_to_assist_category
      ) sub
    ),

    -- Outcomes
    'closed_total', (
      SELECT count(*) FROM connection_requests
      WHERE target_organization_id = p_org_id
        AND created_at >= v_since
        AND closed_at IS NOT NULL
    ),
    'closed_by_type', (
      SELECT jsonb_object_agg(closure_type, cnt)
      FROM (
        SELECT closure_type, count(*) AS cnt
        FROM connection_requests
        WHERE target_organization_id = p_org_id
          AND created_at >= v_since
          AND closure_type IS NOT NULL
        GROUP BY closure_type
      ) sub
    ),
    'reopened_count', (
      SELECT count(*) FROM connection_requests
      WHERE target_organization_id = p_org_id
        AND created_at >= v_since
        AND reopen_count > 0
    ),

    -- Collaboration
    'collaboration_sent', (
      SELECT count(*) FROM connection_requests
      WHERE parent_request_id IN (
        SELECT id FROM connection_requests
        WHERE target_organization_id = p_org_id AND created_at >= v_since
      ) AND is_collaboration = true
    ),

    -- Open requests (not date-bounded — current state)
    'currently_open', (
      SELECT count(*) FROM connection_requests
      WHERE target_organization_id = p_org_id
        AND closed_at IS NULL
        AND status NOT IN ('resolved')
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

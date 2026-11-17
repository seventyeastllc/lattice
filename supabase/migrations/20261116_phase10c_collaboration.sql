-- Phase 10c: Collaboration invitation RPC + org staff listing helper

-- =============================================================================
-- 1. get_org_staff — list active staff at an org for assignment dropdown
-- =============================================================================

CREATE OR REPLACE FUNCTION get_org_staff(p_org_id uuid)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  role text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Caller must be a member of that org or admin
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
  SELECT om.user_id, p.full_name, om.role
  FROM org_members om
  JOIN profiles p ON p.id = om.user_id
  WHERE om.org_id = p_org_id
    AND om.status = 'active'
  ORDER BY p.full_name;
END;
$$;

-- =============================================================================
-- 2. get_invitable_locations — member locations eligible for collaboration
--    (verified, active, not the target org itself)
-- =============================================================================

CREATE OR REPLACE FUNCTION get_invitable_locations(
  p_exclude_org_id uuid DEFAULT NULL
)
RETURNS TABLE (
  location_id uuid,
  location_name text,
  org_id uuid,
  org_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM org_members om
    WHERE om.user_id = auth.uid()
      AND om.status = 'active'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
      RAISE EXCEPTION 'Not authorized';
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    l.id AS location_id,
    l.name AS location_name,
    o.id AS org_id,
    o.name AS org_name
  FROM locations l
  JOIN organizations o ON o.id = l.org_id
  WHERE l.is_active = true
    AND l.is_verified = true
    AND (p_exclude_org_id IS NULL OR o.id != p_exclude_org_id)
  ORDER BY o.name, l.name;
END;
$$;

-- =============================================================================
-- 3. invite_collaborator
--    POC or assigned staff sends a collaboration invitation.
--    Creates a linked child request at the target location's org.
--    Parent inactivity clock is NOT reset (manual decision only).
--    Deduplicates: won't create a second open collaboration for the same
--    parent + target org within 24 hours.
-- =============================================================================

CREATE OR REPLACE FUNCTION invite_collaborator(
  p_parent_request_id uuid,
  p_target_location_id uuid,
  p_message text DEFAULT NULL
)
RETURNS uuid  -- returns the new child request id
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent connection_requests%ROWTYPE;
  v_target_location locations%ROWTYPE;
  v_child_id uuid;
  v_caller_org_id uuid;
BEGIN
  SELECT * INTO v_parent FROM connection_requests WHERE id = p_parent_request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Parent request not found'; END IF;
  IF v_parent.closed_at IS NOT NULL THEN RAISE EXCEPTION 'Cannot invite collaborator on a closed request'; END IF;

  SELECT * INTO v_target_location FROM locations WHERE id = p_target_location_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Target location not found'; END IF;
  IF NOT v_target_location.is_active OR NOT v_target_location.is_verified THEN
    RAISE EXCEPTION 'Target location is not active or verified';
  END IF;

  -- Caller must be POC or assigned staff of the receiving org, or admin
  SELECT om.org_id INTO v_caller_org_id
  FROM org_members om
  WHERE om.user_id = auth.uid()
    AND om.org_id = v_parent.target_organization_id
    AND om.status = 'active'
  LIMIT 1;

  IF v_caller_org_id IS NULL THEN
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
      RAISE EXCEPTION 'Only the receiving organization''s staff may invite collaborators';
    END IF;
  END IF;

  -- Cannot invite own org
  IF v_target_location.org_id = v_parent.target_organization_id THEN
    RAISE EXCEPTION 'Cannot send a collaboration invitation to your own organization';
  END IF;

  -- Deduplicate: check for open collaboration to same target org from same parent within 24h
  IF EXISTS (
    SELECT 1 FROM connection_requests
    WHERE parent_request_id = p_parent_request_id
      AND target_organization_id = v_target_location.org_id
      AND is_collaboration = true
      AND closed_at IS NULL
      AND created_at > now() - interval '24 hours'
  ) THEN
    RAISE EXCEPTION 'An open collaboration invitation to this organization already exists for this request';
  END IF;

  -- Create the child collaboration request
  INSERT INTO connection_requests (
    requesting_user_id,
    target_organization_id,
    location_id,
    request_type,
    notes,
    status,
    is_collaboration,
    parent_request_id
  )
  VALUES (
    v_parent.requesting_user_id,
    v_target_location.org_id,
    p_target_location_id,
    'collaboration',
    COALESCE(p_message, v_parent.notes),
    'pending',
    true,
    p_parent_request_id
  )
  RETURNING id INTO v_child_id;

  -- Do NOT reset parent's inactivity clock — only substantive responses do that
  -- Do NOT close or modify the parent request

  RETURN v_child_id;
END;
$$;

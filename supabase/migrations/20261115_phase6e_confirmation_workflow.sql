-- Phase 6e: Confirmation workflow gaps
--
-- 1. Track when a location became overdue (overdue_at) so we can apply the
--    48-hour TSE alert and 72-hour pause thresholds relative to that timestamp,
--    not just relative to last_confirmed_at.
--
-- 2. Track TSE contact attempts so suspension requires ≥ 2 logged attempts.
--
-- 3. POC-change trigger: when a contact record's primary-contact fields change,
--    immediately pause the linked location and open an urgent review.
--
-- 4. RLS: paused and suspended locations are hidden from the member directory
--    and from public/anonymous views.

-- ─── 0. Fix missing SELECT grant on organizations ────────────────────────────
-- PostgREST rejects any query that JOINs a table the requesting role lacks
-- SELECT access to, returning 403 before RLS even runs.  The RLS policies
-- (defined below) control which rows are visible; this GRANT just allows the
-- query to execute at all.

GRANT SELECT ON organizations TO anon, authenticated;

-- ─── 1. New columns on locations ─────────────────────────────────────────────

ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS overdue_at              timestamptz,
  ADD COLUMN IF NOT EXISTS tse_contact_attempts    integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_confirmed_by       uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS last_login_confirm_at   timestamptz;

-- ─── 2. Non-recursive helper for member-status checks ────────────────────────
-- The organizations RLS policy must NOT query organizations itself or Postgres
-- will raise "infinite recursion detected in policy".  This SECURITY DEFINER
-- function bypasses RLS on organizations (runs as the function owner) so it
-- can safely check the caller's membership status.

CREATE OR REPLACE FUNCTION public.is_active_member()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM organizations
    WHERE user_id = auth.uid()
      AND is_active = true
      AND payment_status = ANY (ARRAY['paid'::text, 'exempt'::text])
  )
$$;

-- Fix the organizations policy that was recursively querying itself:
DROP POLICY IF EXISTS "Active members read directory" ON organizations;
CREATE POLICY "Active members read directory" ON organizations
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND is_active = true
    AND is_verified = true
    AND public.is_active_member()
  );

-- ─── 3. Tighten member-directory visibility ───────────────────────────────────
-- Paused and suspended locations must be invisible to all non-admin callers.
-- (Existing RLS active-members policy allows any is_active + is_verified loc;
-- we add an explicit check that listing_status = 'active'.)

DROP POLICY IF EXISTS "Active members read locations" ON locations;

CREATE POLICY "Active members read locations" ON locations
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND is_active = true
    AND is_verified = true
    AND listing_status = 'active'
    AND EXISTS (
      SELECT 1 FROM organizations AS my_org
      WHERE my_org.user_id = auth.uid()
        AND my_org.is_active = true
        AND my_org.payment_status IN ('paid', 'exempt')
    )
  );

-- Demo locations for anonymous should also only show 'active' ones
DROP POLICY IF EXISTS "Anonymous sees demo locations" ON locations;

CREATE POLICY "Anonymous sees demo locations" ON locations
  FOR SELECT
  USING (
    auth.uid() IS NULL
    AND listing_status = 'active'
    AND EXISTS (
      SELECT 1 FROM organizations o
      WHERE o.id = locations.org_id AND o.is_demo = true
    )
  );

-- ─── 3. TSE task creation helper ─────────────────────────────────────────────
-- Called by listing-check and POC-change trigger to open a review task.
-- Idempotent: does nothing if an open review of that type already exists.

CREATE OR REPLACE FUNCTION create_location_review(
  p_location_id  uuid,
  p_org_id       uuid,
  p_review_type  text,
  p_priority     text,
  p_notes        text,
  p_due_hours    integer   -- hours from now for target_completion
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_id uuid;
BEGIN
  -- Skip if already open
  SELECT id INTO v_id
  FROM location_reviews
  WHERE location_id = p_location_id
    AND review_type = p_review_type
    AND status = 'open';

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  INSERT INTO location_reviews (location_id, org_id, review_type, priority, status, notes, target_completion)
  VALUES (
    p_location_id,
    p_org_id,
    p_review_type,
    p_priority,
    'open',
    p_notes,
    now() + (p_due_hours || ' hours')::interval
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_location_review TO service_role;

-- ─── 4. POC-change trigger ────────────────────────────────────────────────────
-- When a contact's key fields change (or a primary contact is inserted/deleted),
-- immediately pause the linked location and open an urgent POC_CHANGE_REVIEW.

CREATE OR REPLACE FUNCTION contacts_poc_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_location_id  uuid;
  v_org_id       uuid;
BEGIN
  -- Only care about primary contacts
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_primary IS NOT TRUE THEN RETURN OLD; END IF;
    v_location_id := OLD.location_id;
    v_org_id      := OLD.organization_id;
  ELSIF TG_OP = 'INSERT' THEN
    IF NEW.is_primary IS NOT TRUE THEN RETURN NEW; END IF;
    v_location_id := NEW.location_id;
    v_org_id      := NEW.organization_id;
  ELSE -- UPDATE
    -- Trigger if primary flag changed, or key fields changed on a primary contact
    IF NOT (NEW.is_primary OR OLD.is_primary) THEN RETURN NEW; END IF;
    IF NEW.is_primary = OLD.is_primary
       AND NEW.full_name IS NOT DISTINCT FROM OLD.full_name
       AND NEW.email     IS NOT DISTINCT FROM OLD.email
       AND NEW.phone     IS NOT DISTINCT FROM OLD.phone THEN
      RETURN NEW;
    END IF;
    v_location_id := COALESCE(NEW.location_id, OLD.location_id);
    v_org_id      := COALESCE(NEW.organization_id, OLD.organization_id);
  END IF;

  IF v_location_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  -- Pause the location
  UPDATE locations
  SET listing_status = 'paused',
      paused_at      = now(),
      paused_reason  = 'poc_change'
  WHERE id = v_location_id
    AND listing_status NOT IN ('suspended');

  -- Create urgent review (due in 24 hours)
  PERFORM create_location_review(
    v_location_id, v_org_id,
    'poc_change_review', 'urgent',
    'Primary contact record changed. TSE must review and approve before listing is restored.',
    24
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_contacts_poc_change ON contacts;
CREATE TRIGGER trg_contacts_poc_change
  AFTER INSERT OR UPDATE OR DELETE ON contacts
  FOR EACH ROW EXECUTE FUNCTION contacts_poc_change();

-- ─── 5. Admin RPC: log a TSE contact attempt ─────────────────────────────────
-- TSE records each outreach attempt. When ≥ 2 are logged for a paused location,
-- the admin can proceed to suspend it.

CREATE OR REPLACE FUNCTION admin_log_contact_attempt(
  p_location_id uuid,
  p_notes       text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE locations
  SET tse_contact_attempts = tse_contact_attempts + 1
  WHERE id = p_location_id;

  -- Append a note to any open outreach review
  UPDATE location_reviews
  SET notes = COALESCE(notes, '') || E'\n[' || now()::date::text || '] Contact attempt #'
              || (SELECT tse_contact_attempts FROM locations WHERE id = p_location_id)::text
              || COALESCE(': ' || p_notes, '')
  WHERE location_id = p_location_id
    AND review_type IN ('overdue_outreach', 'suspension_pending')
    AND status = 'open'
    AND id = (
      SELECT id FROM location_reviews
      WHERE location_id = p_location_id
        AND review_type IN ('overdue_outreach', 'suspension_pending')
        AND status = 'open'
      ORDER BY created_at DESC LIMIT 1
    );
END;
$$;

GRANT EXECUTE ON FUNCTION admin_log_contact_attempt TO authenticated;

-- ─── 6. Admin RPC: suspend a location (requires ≥ 2 contact attempts) ────────

CREATE OR REPLACE FUNCTION admin_suspend_location(
  p_location_id uuid,
  p_notes       text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_attempts integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT tse_contact_attempts INTO v_attempts
  FROM locations WHERE id = p_location_id;

  IF v_attempts < 2 THEN
    RAISE EXCEPTION 'Cannot suspend: at least 2 TSE contact attempts must be logged (currently %)', v_attempts;
  END IF;

  UPDATE locations
  SET listing_status = 'suspended',
      suspended_at   = now(),
      paused_reason  = COALESCE(p_notes, paused_reason)
  WHERE id = p_location_id;

  -- Close pending suspension review
  UPDATE location_reviews
  SET status = 'resolved', completed_at = now(), completed_by = auth.uid()
  WHERE location_id = p_location_id
    AND review_type = 'suspension_pending'
    AND status = 'open';
END;
$$;

GRANT EXECUTE ON FUNCTION admin_suspend_location TO authenticated;

-- ─── 7. Admin RPC: restore a location after review ───────────────────────────
-- Requires all open reviews for that location to be resolved first.

CREATE OR REPLACE FUNCTION admin_restore_location(
  p_location_id uuid,
  p_notes       text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_open_reviews integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT COUNT(*) INTO v_open_reviews
  FROM location_reviews
  WHERE location_id = p_location_id AND status = 'open';

  IF v_open_reviews > 0 THEN
    RAISE EXCEPTION 'Cannot restore: % open review(s) must be resolved first', v_open_reviews;
  END IF;

  UPDATE locations
  SET listing_status         = 'active',
      paused_at              = NULL,
      paused_reason          = NULL,
      suspended_at           = NULL,
      overdue_at             = NULL,
      tse_contact_attempts   = 0,
      last_confirmed_at      = now()
  WHERE id = p_location_id;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_restore_location TO authenticated;

-- ─── 8. Admin RPC: get pending location reviews ──────────────────────────────

CREATE OR REPLACE FUNCTION admin_get_location_reviews()
RETURNS TABLE (
  review_id          uuid,
  location_id        uuid,
  location_name      text,
  org_id             uuid,
  org_name           text,
  review_type        text,
  priority           text,
  status             text,
  notes              text,
  target_completion  timestamptz,
  created_at         timestamptz,
  listing_status     text,
  tse_contact_attempts integer
)
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT
    lr.id, lr.location_id, loc.name, lr.org_id, o.name,
    lr.review_type, lr.priority, lr.status, lr.notes,
    lr.target_completion, lr.created_at,
    loc.listing_status, loc.tse_contact_attempts
  FROM location_reviews lr
  JOIN locations loc ON loc.id = lr.location_id
  JOIN organizations o ON o.id = lr.org_id
  WHERE lr.status = 'open'
  ORDER BY
    CASE lr.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 ELSE 3 END,
    lr.target_completion ASC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION admin_get_location_reviews TO authenticated;

-- ─── 9. Admin RPC: resolve a review ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION admin_resolve_review(p_review_id uuid, p_notes text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE location_reviews
  SET status = 'resolved', completed_at = now(), completed_by = auth.uid(),
      notes  = COALESCE(p_notes, notes)
  WHERE id = p_review_id;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_resolve_review TO authenticated;

-- ─── 10. Contact-request follow-up task when location is paused/suspended ─────
-- When a connection_request targets an org whose active location is paused,
-- create a 'contact_request_followup' review so TSE can assist the requester.
-- (Trigger fires on INSERT of connection_requests.)

CREATE OR REPLACE FUNCTION connection_request_tse_followup()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_location record;
BEGIN
  -- Find paused/suspended locations for the target org
  FOR v_location IN
    SELECT l.id, l.org_id FROM locations l
    WHERE l.org_id = NEW.target_organization_id
      AND l.listing_status IN ('paused', 'suspended', 'overdue')
      AND l.is_active = true
  LOOP
    PERFORM create_location_review(
      v_location.id, v_location.org_id,
      'contact_request_followup', 'normal',
      'A connection request was submitted for this org while its listing is ' ||
      (SELECT listing_status FROM locations WHERE id = v_location.id) || '. ' ||
      'TSE should follow up with the requesting provider.',
      72
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_connection_request_followup ON connection_requests;
CREATE TRIGGER trg_connection_request_followup
  AFTER INSERT ON connection_requests
  FOR EACH ROW EXECUTE FUNCTION connection_request_tse_followup();

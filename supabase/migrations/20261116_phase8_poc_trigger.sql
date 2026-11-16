-- Phase 8c: Staff removal → POC change trigger
-- When a staff member is removed and their email matches a primary contact
-- on any location in their org, trigger the existing Phase 6e POC review flow:
--   1. Pause the affected location(s)
--   2. Create a poc_change_review task via create_location_review()
--   3. Create follow-up tasks for open connection requests on those locations

CREATE OR REPLACE FUNCTION trg_staff_removal_poc_check()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_email  text;
  v_loc         record;
  v_req         record;
BEGIN
  -- Only fire when status transitions to 'removed'
  IF NEW.status != 'removed' OR OLD.status = 'removed' THEN
    RETURN NEW;
  END IF;

  -- Get the email of the removed user
  SELECT email INTO v_user_email
  FROM auth.users WHERE id = NEW.user_id;

  IF v_user_email IS NULL THEN RETURN NEW; END IF;

  -- Find locations in this org where the removed user is listed as a contact
  FOR v_loc IN
    SELECT l.id AS location_id, l.org_id
    FROM contacts c
    JOIN locations l ON l.id = c.location_id
    WHERE l.org_id = NEW.org_id
      AND lower(c.email) = lower(v_user_email)
      AND l.listing_status NOT IN ('suspended')
  LOOP
    -- Pause the location immediately
    UPDATE locations
    SET listing_status = 'paused',
        paused_at      = now(),
        paused_reason  = 'poc_change'
    WHERE id = v_loc.location_id
      AND listing_status NOT IN ('suspended');

    -- Create (or find existing open) poc_change_review task
    PERFORM create_location_review(
      v_loc.location_id,
      v_loc.org_id,
      'poc_change_review',
      'urgent',
      'Staff member removed: ' || v_user_email || ' was a contact. Verify replacement POC through known channel before restoration.'
    );

    -- Create follow-up tasks for any open connection requests targeting this location
    FOR v_req IN
      SELECT cr.id, cr.requesting_user_id
      FROM connection_requests cr
      JOIN contacts c2 ON c2.id = cr.target_contact_id
      WHERE c2.location_id = v_loc.location_id
        AND cr.status IN ('pending', 'active')
    LOOP
      -- Insert a follow-up review task noting the open request
      INSERT INTO location_reviews (location_id, org_id, review_type, priority, status, notes, target_completion)
      VALUES (
        v_loc.location_id,
        v_loc.org_id,
        'provider_followup',
        'high',
        'open',
        'Open connection request ' || v_req.id || ' exists during POC change. TSE to support requesting provider.',
        now() + interval '48 hours'
      )
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_staff_removal_poc_check ON org_members;
CREATE TRIGGER trg_staff_removal_poc_check
AFTER UPDATE OF status ON org_members
FOR EACH ROW EXECUTE FUNCTION trg_staff_removal_poc_check();

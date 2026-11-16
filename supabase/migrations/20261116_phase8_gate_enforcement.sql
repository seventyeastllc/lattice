-- Phase 8b: Gate enforcement, capacity hardening, email validation
-- Applied via management API (db push history is out of sync)

-- ─── 1. Update get_seat_capacity to reserve pending invitations ───────────────
DROP FUNCTION IF EXISTS get_seat_capacity(uuid);
-- A pending, non-expired invitation counts as a reserved seat so two concurrent
-- invite+accept flows cannot overfill the last seat.
CREATE OR REPLACE FUNCTION get_seat_capacity(p_location_id uuid)
RETURNS TABLE (
  seats_included integer,
  extra_seats    integer,
  total_seats    integer,
  seats_used     integer,
  seats_available integer
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    bc.staff_seats_included,
    COALESCE(l.extra_staff_seats, 0),
    bc.staff_seats_included + COALESCE(l.extra_staff_seats, 0),
    -- seats_used = active members + pending non-expired invitations
    COALESCE(lsu.seats_used, 0) +
      (SELECT COUNT(*) FROM staff_invitations si
       WHERE si.location_id = p_location_id
         AND si.status = 'pending'
         AND si.expires_at > now()),
    bc.staff_seats_included + COALESCE(l.extra_staff_seats, 0)
      - COALESCE(lsu.seats_used, 0)
      - (SELECT COUNT(*) FROM staff_invitations si
         WHERE si.location_id = p_location_id
           AND si.status = 'pending'
           AND si.expires_at > now())
  FROM locations l
  JOIN organizations o ON o.id = l.org_id
  JOIN billing_config bc ON bc.tier = COALESCE(o.tier, 'participant')
  LEFT JOIN location_seat_usage lsu ON lsu.location_id = l.id
  WHERE l.id = p_location_id;
$$;
GRANT EXECUTE ON FUNCTION get_seat_capacity TO authenticated, anon;

-- ─── 2. Revoke direct write access to staff_invitations ──────────────────────
-- Only the SECURITY DEFINER RPCs (org_invite_staff, accept_staff_invitation)
-- may write to this table.  The RPCs run as the postgres/definer role and do
-- not need authenticated grants.
REVOKE INSERT, UPDATE, DELETE ON staff_invitations FROM anon;
REVOKE INSERT, UPDATE, DELETE ON staff_invitations FROM authenticated;

-- ─── 3. Atomic capacity trigger on staff_invitations ─────────────────────────
-- Belt-and-suspenders check independent of RPC logic.
CREATE OR REPLACE FUNCTION trg_check_invitation_capacity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_cap record;
BEGIN
  IF NEW.location_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO v_cap FROM get_seat_capacity(NEW.location_id);
  -- After this insert would be one seat more consumed; available must be >= 0
  -- get_seat_capacity already counts pending invitations, so after the row
  -- commits the count will include this new row.  Check >= 1 available before.
  IF v_cap.seats_available < 1 THEN
    RAISE EXCEPTION 'No seats available at this location (% of % in use)',
      v_cap.seats_used, v_cap.total_seats;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_capacity_before_invite ON staff_invitations;
CREATE TRIGGER check_capacity_before_invite
BEFORE INSERT ON staff_invitations
FOR EACH ROW EXECUTE FUNCTION trg_check_invitation_capacity();

-- ─── 4. Email validation + duplicate-membership guard in accept_staff_invitation
CREATE OR REPLACE FUNCTION accept_staff_invitation(p_token uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_inv   record;
  v_cap   record;
  v_mem_id uuid;
BEGIN
  -- Look up invitation with row-level lock to serialise concurrent acceptances
  SELECT * INTO v_inv FROM staff_invitations
  WHERE token = p_token AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found or already used';
  END IF;

  IF v_inv.expires_at < now() THEN
    UPDATE staff_invitations SET status = 'expired' WHERE id = v_inv.id;
    RAISE EXCEPTION 'Invitation has expired';
  END IF;

  -- Email must match authenticated user
  IF lower(auth.email()) != lower(v_inv.email) THEN
    RAISE EXCEPTION 'This invitation was sent to %. Sign in with that email address.',
      v_inv.email;
  END IF;

  -- Duplicate active membership check
  IF EXISTS (
    SELECT 1 FROM org_members
    WHERE org_id = v_inv.org_id AND user_id = auth.uid() AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'You already have an active membership in this organization';
  END IF;

  -- Recheck seat capacity at acceptance time (pending count now includes this invitation)
  IF v_inv.location_id IS NOT NULL THEN
    SELECT * INTO v_cap FROM get_seat_capacity(v_inv.location_id);
    -- At this point this invitation is counted in seats_used (it is still pending).
    -- After marking accepted, the invitation leaves pending count and the new
    -- org_members row enters active count.  Net effect is neutral, but we need
    -- at least 0 net available to allow the swap.
    IF v_cap.seats_available < 0 THEN
      RAISE EXCEPTION 'No seats available for this location';
    END IF;
  END IF;

  -- Create org_member row (default status = 'active' set by column default or here)
  INSERT INTO org_members (org_id, user_id, role, location_id, invitation_id, joined_at, status)
  VALUES (v_inv.org_id, auth.uid(), v_inv.role, v_inv.location_id, v_inv.id, now(), 'active')
  RETURNING id INTO v_mem_id;

  -- Mark invitation accepted
  UPDATE staff_invitations
  SET status = 'accepted', accepted_at = now(), accepted_by = auth.uid()
  WHERE id = v_inv.id;

  RETURN jsonb_build_object(
    'member_id',   v_mem_id,
    'org_id',      v_inv.org_id,
    'role',        v_inv.role,
    'location_id', v_inv.location_id
  );
END;
$$;
GRANT EXECUTE ON FUNCTION accept_staff_invitation TO authenticated;

-- ─── 5. Update check_staff_gate to exempt org owners ─────────────────────────
-- Org owners (organizations.user_id = auth.uid()) are not invited staff and
-- are not subject to the orientation gate.
CREATE OR REPLACE FUNCTION check_staff_gate(p_org_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    CASE
      -- Org owner: always has full access
      WHEN EXISTS (SELECT 1 FROM organizations WHERE id = p_org_id AND user_id = auth.uid())
      THEN jsonb_build_object(
        'is_member',        true,
        'orientation_done', true,
        'roe_done',         true,
        'can_use_tools',    true,
        'is_owner',         true
      )
      -- Invited/active staff member
      WHEN EXISTS (SELECT 1 FROM org_members om
                   WHERE om.org_id = p_org_id AND om.user_id = auth.uid()
                     AND om.status = 'active')
      THEN jsonb_build_object(
        'is_member',        true,
        'orientation_done', EXISTS (SELECT 1 FROM orientation_completions oc
                                    WHERE oc.user_id = auth.uid() AND oc.org_id = p_org_id),
        'roe_done',         EXISTS (SELECT 1 FROM roe_acknowledgments ra
                                    WHERE ra.user_id = auth.uid() AND ra.org_id = p_org_id),
        'can_use_tools',    EXISTS (SELECT 1 FROM orientation_completions oc
                                    WHERE oc.user_id = auth.uid() AND oc.org_id = p_org_id)
                            AND EXISTS (SELECT 1 FROM roe_acknowledgments ra
                                        WHERE ra.user_id = auth.uid() AND ra.org_id = p_org_id),
        'is_owner',         false
      )
      -- Not a member
      ELSE jsonb_build_object(
        'is_member',        false,
        'orientation_done', false,
        'roe_done',         false,
        'can_use_tools',    false,
        'is_owner',         false
      )
    END;
$$;
GRANT EXECUTE ON FUNCTION check_staff_gate TO authenticated, anon;

-- ─── 6. assert_staff_gate: server-side gate for coordination-tool RPCs ────────
-- Call this at the top of any RPC that provides coordination tools.
-- Org owners and members without an invitation_id (manually added) are exempt.
-- Invited staff with incomplete orientation/ROE are blocked.
CREATE OR REPLACE FUNCTION assert_staff_gate(p_org_id uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE v_mem record;
BEGIN
  -- Org owner: always allowed
  IF EXISTS (SELECT 1 FROM organizations WHERE id = p_org_id AND user_id = auth.uid()) THEN
    RETURN;
  END IF;

  -- Look up org_members row for current user
  SELECT * INTO v_mem FROM org_members
  WHERE org_id = p_org_id AND user_id = auth.uid() AND status = 'active'
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'You do not have an active membership in this organization';
  END IF;

  -- Members added without an invitation (invitation_id IS NULL) are exempt
  -- (original owner-era members, manual admin grants).
  IF v_mem.invitation_id IS NULL THEN
    RETURN;
  END IF;

  -- Invited members must complete orientation and ROE
  IF NOT EXISTS (SELECT 1 FROM orientation_completions
                 WHERE user_id = auth.uid() AND org_id = p_org_id) THEN
    RAISE EXCEPTION 'Orientation must be completed before using coordination tools';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM roe_acknowledgments
                 WHERE user_id = auth.uid() AND org_id = p_org_id) THEN
    RAISE EXCEPTION 'Rules of Engagement must be acknowledged before using coordination tools';
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION assert_staff_gate TO authenticated;

-- ─── 7. invitation_delivery_log table ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invitation_delivery_log (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id       uuid NOT NULL REFERENCES staff_invitations(id) ON DELETE CASCADE,
  status              text NOT NULL DEFAULT 'pending',  -- pending, sent, failed
  provider_message_id text,
  error               text,
  attempted_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inv_delivery_invitation
  ON invitation_delivery_log (invitation_id);

-- Only service_role reads/writes delivery log (no authenticated access)
REVOKE ALL ON invitation_delivery_log FROM anon, authenticated;
GRANT ALL ON invitation_delivery_log TO service_role;

-- Allow admin RPCs to query delivery log
GRANT SELECT ON invitation_delivery_log TO authenticated;

-- RLS: TSE admins can see all; others see none
ALTER TABLE invitation_delivery_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_see_delivery_log" ON invitation_delivery_log
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

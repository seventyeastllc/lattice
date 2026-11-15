-- Phase 8: Staff Account Workflow
--
-- Rules implemented:
--   • Individual credentials per user with org/location access
--   • 4 included seats per paid enrolled location + purchased extra seats
--   • Org admins can invite staff and remove departing staff
--   • Historical activity preserved under original user (soft-remove only)
--   • Replacements must complete orientation + acknowledge ROE before tools
--   • POC change → location pause already handled by Phase 6e trigger
--
-- Roles in org_members.role:
--   'org_admin'  — can invite/remove staff, represents the organization
--   'staff'      — regular staff, coordination tools after orientation gate
--
-- Invitation flow:
--   org_invite_staff() → staff_invitations row + token
--   invited user signs up → hits /invite/:token → accept_staff_invitation()
--   → orientation + ROE gate before coordination tools

-- ─── 1. Extend org_members ───────────────────────────────────────────────────

ALTER TABLE org_members
  ADD COLUMN IF NOT EXISTS status           text NOT NULL DEFAULT 'active'
                                            CHECK (status IN ('active','removed')),
  ADD COLUMN IF NOT EXISTS removed_at       timestamptz,
  ADD COLUMN IF NOT EXISTS removed_by       uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS removed_reason   text,
  ADD COLUMN IF NOT EXISTS invitation_id    uuid,  -- FK added after table creation
  ADD COLUMN IF NOT EXISTS joined_at        timestamptz DEFAULT now();

-- ─── 2. staff_invitations ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS staff_invitations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id   uuid REFERENCES locations(id) ON DELETE SET NULL,
  invited_by    uuid NOT NULL REFERENCES auth.users(id),
  email         text NOT NULL,
  full_name     text,
  role          text NOT NULL DEFAULT 'staff' CHECK (role IN ('org_admin','staff')),
  token         uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  status        text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','accepted','expired','cancelled')),
  expires_at    timestamptz NOT NULL DEFAULT now() + interval '7 days',
  accepted_at   timestamptz,
  accepted_by   uuid REFERENCES auth.users(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS staff_invitations_org_idx   ON staff_invitations(org_id);
CREATE INDEX IF NOT EXISTS staff_invitations_token_idx ON staff_invitations(token);
CREATE INDEX IF NOT EXISTS staff_invitations_email_idx ON staff_invitations(email);

ALTER TABLE org_members
  ADD CONSTRAINT org_members_invitation_fk
  FOREIGN KEY (invitation_id) REFERENCES staff_invitations(id)
  ON DELETE SET NULL
  NOT VALID;

-- ─── 3. orientation_content ──────────────────────────────────────────────────
-- Stores versioned orientation modules. Active modules are shown to new staff.

CREATE TABLE IF NOT EXISTS orientation_content (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version     text NOT NULL UNIQUE,  -- e.g. 'v1', 'v2'
  title       text NOT NULL,
  body_html   text NOT NULL,         -- rendered HTML content
  is_active   boolean NOT NULL DEFAULT true,
  is_test     boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Insert placeholder test orientation
INSERT INTO orientation_content (version, title, body_html, is_active, is_test)
VALUES (
  'v1-test',
  '[TEST] Staff Orientation — Placeholder',
  '<div class="orientation-content">
    <h2>Welcome to the Lattice Network</h2>
    <p><strong>This is a test orientation module.</strong> Final content is pending review.</p>
    <h3>What you will learn</h3>
    <ul>
      <li>How to use the member directory to find partner organizations</li>
      <li>How to submit and manage coordination requests</li>
      <li>Your responsibilities as a network participant</li>
      <li>Confidentiality and data handling requirements</li>
      <li>How to update your organization''s listing</li>
    </ul>
    <h3>Coordination Standards</h3>
    <p>All network participants agree to respond to coordination requests within 2 business days, maintain accurate listing information, and treat all client referral information as confidential.</p>
    <h3>Test Question</h3>
    <p>By completing this orientation you confirm that you have read and understood the above information.</p>
  </div>',
  true,
  true
)
ON CONFLICT (version) DO NOTHING;

-- ─── 4. roe_content ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS roe_content (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version     text NOT NULL UNIQUE,
  title       text NOT NULL,
  body_html   text NOT NULL,
  is_active   boolean NOT NULL DEFAULT true,
  is_test     boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO roe_content (version, title, body_html, is_active, is_test)
VALUES (
  'v1-test',
  '[TEST] Rules of Engagement — Placeholder',
  '<div class="roe-content">
    <h2>Rules of Engagement</h2>
    <p><strong>This is a test document.</strong> Final Rules of Engagement are pending legal review.</p>
    <h3>Core Commitments</h3>
    <ol>
      <li><strong>Confidentiality:</strong> All client information shared through the network is confidential and may not be disclosed outside the coordination workflow.</li>
      <li><strong>Accuracy:</strong> You will keep your organization''s listing and contact information current.</li>
      <li><strong>Responsiveness:</strong> You will respond to coordination requests within 2 business days.</li>
      <li><strong>Respect:</strong> All network communications will be professional and respectful.</li>
      <li><strong>Compliance:</strong> You will comply with all applicable laws regarding the clients you serve.</li>
    </ol>
    <h3>Consequences of Violation</h3>
    <p>Violations of these rules may result in suspension or removal from the network at the discretion of The Seed Exchange.</p>
  </div>',
  true,
  true
)
ON CONFLICT (version) DO NOTHING;

-- ─── 5. orientation_completions ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS orientation_completions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id              uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  orientation_version text NOT NULL,
  completed_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, org_id, orientation_version)
);

CREATE INDEX IF NOT EXISTS orientation_completions_user_idx ON orientation_completions(user_id);

-- ─── 6. roe_acknowledgments ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS roe_acknowledgments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  roe_version     text NOT NULL,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, org_id, roe_version)
);

CREATE INDEX IF NOT EXISTS roe_acknowledgments_user_idx ON roe_acknowledgments(user_id);

-- ─── 7. Grants ───────────────────────────────────────────────────────────────

GRANT SELECT ON staff_invitations TO authenticated;
GRANT SELECT ON orientation_content TO authenticated;
GRANT SELECT ON roe_content TO authenticated;
GRANT SELECT, INSERT ON orientation_completions TO authenticated;
GRANT SELECT, INSERT ON roe_acknowledgments TO authenticated;
GRANT ALL ON staff_invitations TO service_role;
GRANT ALL ON orientation_content TO service_role;
GRANT ALL ON roe_content TO service_role;
GRANT ALL ON orientation_completions TO service_role;
GRANT ALL ON roe_acknowledgments TO service_role;

-- ─── 8. RLS on new tables ────────────────────────────────────────────────────

ALTER TABLE staff_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE orientation_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE roe_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE orientation_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE roe_acknowledgments ENABLE ROW LEVEL SECURITY;

-- Invitation visibility: inviter's org, or the invited email, or by token lookup
CREATE POLICY "Org members see their org's invitations" ON staff_invitations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.org_id = staff_invitations.org_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
    OR auth.uid() = accepted_by
  );

CREATE POLICY "Org admins manage invitations" ON staff_invitations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.org_id = staff_invitations.org_id
        AND om.user_id = auth.uid()
        AND om.role = 'org_admin'
        AND om.status = 'active'
    )
  );

CREATE POLICY "Active orientation content visible to authenticated" ON orientation_content
  FOR SELECT USING (auth.uid() IS NOT NULL AND is_active = true);

CREATE POLICY "Active ROE content visible to authenticated" ON roe_content
  FOR SELECT USING (auth.uid() IS NOT NULL AND is_active = true);

CREATE POLICY "Users manage their own orientation completions" ON orientation_completions
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users manage their own ROE acknowledgments" ON roe_acknowledgments
  FOR ALL USING (user_id = auth.uid());

-- ─── 9. Update location_seat_usage view ──────────────────────────────────────
-- Count only ACTIVE members; roles are now 'org_admin' and 'staff'

CREATE OR REPLACE VIEW location_seat_usage AS
  SELECT
    location_id,
    COUNT(*) FILTER (
      WHERE status = 'active'
        AND role IN ('org_admin', 'staff', 'admin', 'member')
    ) AS seats_used
  FROM org_members
  WHERE location_id IS NOT NULL
  GROUP BY location_id;

-- ─── 10. Helper: get_seat_capacity(location_id) ───────────────────────────────

CREATE OR REPLACE FUNCTION get_seat_capacity(p_location_id uuid)
RETURNS TABLE (
  seats_included  integer,
  extra_seats     integer,
  total_seats     integer,
  seats_used      bigint,
  seats_available integer
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    bc.staff_seats_included,
    COALESCE(l.extra_staff_seats, 0),
    bc.staff_seats_included + COALESCE(l.extra_staff_seats, 0),
    COALESCE(lsu.seats_used, 0),
    bc.staff_seats_included + COALESCE(l.extra_staff_seats, 0)
      - COALESCE(lsu.seats_used, 0)
  FROM locations l
  JOIN organizations o ON o.id = l.org_id
  JOIN billing_config bc ON bc.tier = COALESCE(o.tier, 'participant')
  LEFT JOIN location_seat_usage lsu ON lsu.location_id = l.id
  WHERE l.id = p_location_id;
$$;

GRANT EXECUTE ON FUNCTION get_seat_capacity TO authenticated;

-- ─── 11. RPC: org_invite_staff ───────────────────────────────────────────────
-- Called by org_admin. Checks seat limit, creates invitation row.
-- Returns the invitation token so the UI can build the invite URL.

CREATE OR REPLACE FUNCTION org_invite_staff(
  p_org_id      uuid,
  p_location_id uuid,
  p_email       text,
  p_role        text DEFAULT 'staff',
  p_full_name   text DEFAULT NULL
)
RETURNS uuid  -- the invitation token
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_cap    record;
  v_token  uuid;
BEGIN
  -- Must be org_admin for this org
  IF NOT EXISTS (
    SELECT 1 FROM org_members
    WHERE org_id = p_org_id AND user_id = auth.uid()
      AND role = 'org_admin' AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Only org admins can invite staff';
  END IF;

  -- Seat limit check (org_admin role invites don't consume a seat until accepted)
  -- We check if accepting would exceed capacity
  SELECT * INTO v_cap FROM get_seat_capacity(p_location_id);
  IF v_cap.seats_available <= 0 THEN
    RAISE EXCEPTION 'Seat limit reached: % of % seats in use. Purchase additional seats to invite more staff.',
      v_cap.seats_used, v_cap.total_seats;
  END IF;

  -- Cancel any existing pending invitation for this email+org
  UPDATE staff_invitations
  SET status = 'cancelled'
  WHERE org_id = p_org_id AND email = lower(p_email) AND status = 'pending';

  -- Create new invitation
  INSERT INTO staff_invitations (org_id, location_id, invited_by, email, full_name, role)
  VALUES (p_org_id, p_location_id, auth.uid(), lower(p_email), p_full_name, p_role)
  RETURNING token INTO v_token;

  RETURN v_token;
END;
$$;

GRANT EXECUTE ON FUNCTION org_invite_staff TO authenticated;

-- ─── 12. RPC: accept_staff_invitation ────────────────────────────────────────
-- Called after the invited user has authenticated (signed up / logged in).
-- Validates token, creates org_member row.

CREATE OR REPLACE FUNCTION accept_staff_invitation(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_inv   record;
  v_cap   record;
  v_mem_id uuid;
BEGIN
  -- Look up invitation
  SELECT * INTO v_inv FROM staff_invitations
  WHERE token = p_token AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found or already used';
  END IF;

  IF v_inv.expires_at < now() THEN
    UPDATE staff_invitations SET status = 'expired' WHERE id = v_inv.id;
    RAISE EXCEPTION 'Invitation has expired';
  END IF;

  -- Seat check at acceptance time
  IF v_inv.location_id IS NOT NULL THEN
    SELECT * INTO v_cap FROM get_seat_capacity(v_inv.location_id);
    IF v_cap.seats_available <= 0 THEN
      RAISE EXCEPTION 'No seats available for this location';
    END IF;
  END IF;

  -- Remove any existing removed membership for this user+org (allow re-invite)
  -- but do NOT delete — just check for active duplicate
  IF EXISTS (
    SELECT 1 FROM org_members
    WHERE org_id = v_inv.org_id AND user_id = auth.uid() AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'You are already a member of this organization';
  END IF;

  -- Create org_member row
  INSERT INTO org_members (org_id, user_id, role, location_id, invitation_id, joined_at)
  VALUES (v_inv.org_id, auth.uid(), v_inv.role, v_inv.location_id, v_inv.id, now())
  RETURNING id INTO v_mem_id;

  -- Mark invitation accepted
  UPDATE staff_invitations
  SET status = 'accepted', accepted_at = now(), accepted_by = auth.uid()
  WHERE id = v_inv.id;

  RETURN jsonb_build_object(
    'member_id', v_mem_id,
    'org_id',    v_inv.org_id,
    'role',      v_inv.role,
    'location_id', v_inv.location_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION accept_staff_invitation TO authenticated;

-- ─── 13. RPC: org_remove_staff ───────────────────────────────────────────────
-- Soft-removes a staff member. Historical activity preserved.

CREATE OR REPLACE FUNCTION org_remove_staff(
  p_member_id uuid,
  p_reason    text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_mem record;
BEGIN
  SELECT * INTO v_mem FROM org_members WHERE id = p_member_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Member not found'; END IF;

  -- Must be org_admin for this org, or a global admin
  IF NOT EXISTS (
    SELECT 1 FROM org_members
    WHERE org_id = v_mem.org_id AND user_id = auth.uid()
      AND role = 'org_admin' AND status = 'active'
  ) AND NOT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: only org admins can remove staff';
  END IF;

  -- Cannot remove the last org_admin
  IF v_mem.role = 'org_admin' AND (
    SELECT COUNT(*) FROM org_members
    WHERE org_id = v_mem.org_id AND role = 'org_admin' AND status = 'active'
  ) <= 1 THEN
    RAISE EXCEPTION 'Cannot remove the last org admin';
  END IF;

  UPDATE org_members
  SET status        = 'removed',
      removed_at    = now(),
      removed_by    = auth.uid(),
      removed_reason = p_reason
  WHERE id = p_member_id;
END;
$$;

GRANT EXECUTE ON FUNCTION org_remove_staff TO authenticated;

-- ─── 14. RPC: org_get_staff ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION org_get_staff(p_org_id uuid)
RETURNS TABLE (
  member_id            uuid,
  user_id              uuid,
  role                 text,
  status               text,
  location_id          uuid,
  location_name        text,
  joined_at            timestamptz,
  removed_at           timestamptz,
  removed_reason       text,
  orientation_done     boolean,
  roe_done             boolean,
  full_name            text,
  email                text
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    om.id,
    om.user_id,
    om.role,
    om.status,
    om.location_id,
    l.name,
    om.joined_at,
    om.removed_at,
    om.removed_reason,
    EXISTS (
      SELECT 1 FROM orientation_completions oc
      WHERE oc.user_id = om.user_id AND oc.org_id = p_org_id
    ),
    EXISTS (
      SELECT 1 FROM roe_acknowledgments ra
      WHERE ra.user_id = om.user_id AND ra.org_id = p_org_id
    ),
    p.full_name,
    u.email
  FROM org_members om
  LEFT JOIN locations l ON l.id = om.location_id
  LEFT JOIN profiles p ON p.id = om.user_id
  LEFT JOIN auth.users u ON u.id = om.user_id
  WHERE om.org_id = p_org_id
    AND (
      -- org admin for this org, or global admin
      EXISTS (
        SELECT 1 FROM org_members admin_om
        WHERE admin_om.org_id = p_org_id
          AND admin_om.user_id = auth.uid()
          AND admin_om.role = 'org_admin'
          AND admin_om.status = 'active'
      )
      OR EXISTS (
        SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
      )
    )
  ORDER BY om.status, om.joined_at;
$$;

GRANT EXECUTE ON FUNCTION org_get_staff TO authenticated;

-- ─── 15. RPC: get_invitation_by_token ────────────────────────────────────────
-- Public lookup (no auth required) so the invitation page can show org details.

CREATE OR REPLACE FUNCTION get_invitation_by_token(p_token uuid)
RETURNS TABLE (
  invitation_id  uuid,
  org_id         uuid,
  org_name       text,
  location_id    uuid,
  location_name  text,
  invited_email  text,
  invited_name   text,
  role           text,
  status         text,
  expires_at     timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    si.id,
    si.org_id,
    o.name,
    si.location_id,
    l.name,
    si.email,
    si.full_name,
    si.role,
    si.status,
    si.expires_at
  FROM staff_invitations si
  JOIN organizations o ON o.id = si.org_id
  LEFT JOIN locations l ON l.id = si.location_id
  WHERE si.token = p_token;
$$;

GRANT EXECUTE ON FUNCTION get_invitation_by_token TO anon, authenticated;

-- ─── 16. RPC: check_staff_gate ───────────────────────────────────────────────
-- Returns whether the calling user can use coordination tools for a given org.

CREATE OR REPLACE FUNCTION check_staff_gate(p_org_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT jsonb_build_object(
    'is_member',         EXISTS (
                           SELECT 1 FROM org_members om
                           WHERE om.org_id = p_org_id AND om.user_id = auth.uid()
                             AND om.status = 'active'
                         ),
    'orientation_done',  EXISTS (
                           SELECT 1 FROM orientation_completions oc
                           WHERE oc.user_id = auth.uid() AND oc.org_id = p_org_id
                         ),
    'roe_done',          EXISTS (
                           SELECT 1 FROM roe_acknowledgments ra
                           WHERE ra.user_id = auth.uid() AND ra.org_id = p_org_id
                         ),
    'can_use_tools',     EXISTS (
                           SELECT 1 FROM org_members om
                           WHERE om.org_id = p_org_id AND om.user_id = auth.uid()
                             AND om.status = 'active'
                         )
                         AND EXISTS (
                           SELECT 1 FROM orientation_completions oc
                           WHERE oc.user_id = auth.uid() AND oc.org_id = p_org_id
                         )
                         AND EXISTS (
                           SELECT 1 FROM roe_acknowledgments ra
                           WHERE ra.user_id = auth.uid() AND ra.org_id = p_org_id
                         )
  );
$$;

GRANT EXECUTE ON FUNCTION check_staff_gate TO authenticated;

-- ─── 17. RPC: staff_complete_orientation ─────────────────────────────────────

CREATE OR REPLACE FUNCTION staff_complete_orientation(
  p_org_id  uuid,
  p_version text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM org_members om
    WHERE om.org_id = p_org_id AND om.user_id = auth.uid() AND om.status = 'active'
  ) THEN
    RAISE EXCEPTION 'You are not an active member of this organization';
  END IF;

  INSERT INTO orientation_completions (user_id, org_id, orientation_version)
  VALUES (auth.uid(), p_org_id, p_version)
  ON CONFLICT (user_id, org_id, orientation_version) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION staff_complete_orientation TO authenticated;

-- ─── 18. RPC: staff_acknowledge_roe ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION staff_acknowledge_roe(
  p_org_id  uuid,
  p_version text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM org_members om
    WHERE om.org_id = p_org_id AND om.user_id = auth.uid() AND om.status = 'active'
  ) THEN
    RAISE EXCEPTION 'You are not an active member of this organization';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM orientation_completions oc
    WHERE oc.user_id = auth.uid() AND oc.org_id = p_org_id
  ) THEN
    RAISE EXCEPTION 'Complete orientation before acknowledging the Rules of Engagement';
  END IF;

  INSERT INTO roe_acknowledgments (user_id, org_id, roe_version)
  VALUES (auth.uid(), p_org_id, p_version)
  ON CONFLICT (user_id, org_id, roe_version) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION staff_acknowledge_roe TO authenticated;

-- ─── 19. Admin RPCs: invitation management ───────────────────────────────────

CREATE OR REPLACE FUNCTION admin_get_all_invitations()
RETURNS TABLE (
  invitation_id  uuid,
  org_name       text,
  location_name  text,
  email          text,
  full_name      text,
  role           text,
  status         text,
  expires_at     timestamptz,
  created_at     timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    si.id, o.name, l.name, si.email, si.full_name, si.role,
    si.status, si.expires_at, si.created_at
  FROM staff_invitations si
  JOIN organizations o ON o.id = si.org_id
  LEFT JOIN locations l ON l.id = si.location_id
  ORDER BY si.created_at DESC
  LIMIT 200;
$$;

GRANT EXECUTE ON FUNCTION admin_get_all_invitations TO authenticated;

-- ─── 20. Admin RPC: orientation content management ───────────────────────────

CREATE OR REPLACE FUNCTION admin_upsert_orientation(
  p_version    text,
  p_title      text,
  p_body_html  text,
  p_is_test    boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Deactivate previous active non-test versions if making a new active one
  UPDATE orientation_content SET is_active = false
  WHERE is_active = true AND is_test = false AND version != p_version;

  INSERT INTO orientation_content (version, title, body_html, is_active, is_test)
  VALUES (p_version, p_title, p_body_html, true, p_is_test)
  ON CONFLICT (version) DO UPDATE
    SET title = EXCLUDED.title, body_html = EXCLUDED.body_html, is_test = EXCLUDED.is_test
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_upsert_orientation TO authenticated;

CREATE OR REPLACE FUNCTION admin_upsert_roe(
  p_version    text,
  p_title      text,
  p_body_html  text,
  p_is_test    boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE roe_content SET is_active = false
  WHERE is_active = true AND is_test = false AND version != p_version;

  INSERT INTO roe_content (version, title, body_html, is_active, is_test)
  VALUES (p_version, p_title, p_body_html, true, p_is_test)
  ON CONFLICT (version) DO UPDATE
    SET title = EXCLUDED.title, body_html = EXCLUDED.body_html, is_test = EXCLUDED.is_test
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_upsert_roe TO authenticated;

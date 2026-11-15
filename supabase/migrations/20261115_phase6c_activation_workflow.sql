-- Phase 6c: Application-to-activation workflow fields and tables
--
-- Adds per-stage tracking to organizations and a table for
-- implementation session scheduling.

-- ─── 1. Organizations: workflow stage fields ──────────────────────────────────

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS verification_call_notes  text,
  ADD COLUMN IF NOT EXISTS verification_call_at     timestamptz,
  ADD COLUMN IF NOT EXISTS agreement_signed_at      timestamptz,
  ADD COLUMN IF NOT EXISTS payment_requested_at     timestamptz,
  ADD COLUMN IF NOT EXISTS activated_at             timestamptz;

-- ─── 2. Implementation sessions ───────────────────────────────────────────────
-- Two 90-minute cohort implementation sessions, one week apart.
-- scheduled_at / calendar_link are set by TSE when booking is confirmed.

CREATE TABLE IF NOT EXISTS implementation_sessions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  session_number  integer     NOT NULL CHECK (session_number IN (1, 2)),
  scheduled_at    timestamptz,
  calendar_link   text,
  notes           text,
  completed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, session_number)
);

CREATE INDEX IF NOT EXISTS idx_impl_sessions_org_id ON implementation_sessions(org_id);

ALTER TABLE implementation_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manages implementation sessions" ON implementation_sessions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
-- Org owner can read their own sessions
CREATE POLICY "Org owner reads own sessions" ON implementation_sessions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM organizations WHERE id = org_id AND user_id = auth.uid())
  );

-- ─── 3. Admin RPC: activate organization ─────────────────────────────────────
-- Sets is_active, activated_at, renewal_date (12 months from today),
-- and activates all locations for the org atomically.
-- SECURITY DEFINER so the app can call it without admin-role JWT.

CREATE OR REPLACE FUNCTION admin_activate_org(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_now        timestamptz := now();
  v_renewal    date        := (v_now + interval '12 months')::date;
BEGIN
  -- Verify caller is a TSE admin
  IF NOT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE organizations
  SET
    is_active        = true,
    is_verified      = true,
    activated_at     = v_now,
    renewal_date     = v_renewal,
    payment_status   = CASE WHEN payment_status = 'unpaid' THEN 'paid' ELSE payment_status END
  WHERE id = p_org_id;

  -- Activate all locations for this org
  UPDATE locations
  SET
    is_active        = true,
    is_verified      = true,
    listing_status   = 'active',
    enrollment_date  = COALESCE(enrollment_date, v_now::date)
  WHERE org_id = p_org_id;

  -- Create implementation session placeholders (1 and 2) if not already present
  INSERT INTO implementation_sessions (org_id, session_number)
  VALUES (p_org_id, 1), (p_org_id, 2)
  ON CONFLICT (org_id, session_number) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_activate_org TO authenticated;

-- ─── 4. Update admin_get_pending_orgs RPC to include new fields ───────────────
-- (Drop and recreate so it returns the new columns)

DROP FUNCTION IF EXISTS admin_get_pending_orgs();

CREATE OR REPLACE FUNCTION admin_get_pending_orgs()
RETURNS TABLE (
  id                      uuid,
  name                    text,
  slug                    text,
  org_type                text,
  county                  text,
  description             text,
  membership_tier         text,
  payment_status          text,
  claimed_lead_id         text,
  is_active               boolean,
  is_verified             boolean,
  created_at              timestamptz,
  verification_call_notes text,
  verification_call_at    timestamptz,
  agreement_signed_at     timestamptz,
  payment_requested_at    timestamptz,
  activated_at            timestamptz,
  contacts                json
)
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT
    o.id, o.name, o.slug, o.org_type, o.county, o.description,
    o.membership_tier, o.payment_status, o.claimed_lead_id,
    o.is_active, o.is_verified, o.created_at,
    o.verification_call_notes, o.verification_call_at,
    o.agreement_signed_at, o.payment_requested_at, o.activated_at,
    COALESCE(
      (SELECT json_agg(json_build_object(
        'id', c.id, 'full_name', c.full_name, 'title', c.title,
        'email', c.email, 'phone', c.phone, 'is_primary', c.is_primary
      ))
      FROM contacts c WHERE c.organization_id = o.id),
      '[]'::json
    ) AS contacts
  FROM organizations o
  WHERE o.is_active = false
  ORDER BY o.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION admin_get_pending_orgs TO authenticated;

-- Phase 6d: Membership gate, four-tier model, activation prerequisites
--
-- 1. Restrict org/location/contact data: full records visible only to
--    authenticated active+paid members or admins. Unauthenticated callers
--    see only the demo/prelaunch set (is_demo = true), never real contact data.
--
-- 2. Add participant tier to billing_config (the base cumulative level).
--    Add is_founding_member flag to organizations for two-year rate protection.
--
-- 3. Strengthen admin_activate_org: requires is_verified, agreement_signed_at,
--    and payment_status = 'paid' or 'exempt' before activation.

-- ─── 1a. Add demo flag to organizations ──────────────────────────────────────
-- Demo orgs are real or curated listings intentionally visible to anonymous
-- visitors to illustrate the directory before they join.

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

-- ─── 1b. Add founding member flag ────────────────────────────────────────────
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS is_founding_member boolean NOT NULL DEFAULT false;

-- ─── 1c. Replace public-read RLS on organizations ────────────────────────────
-- Old policy: anyone can see active+verified orgs (exposes contact data).
-- New policy: anonymous users see ONLY demo orgs (name/description/county/services).
--             Authenticated active+paid members see the full directory.
--             Org owners always see their own record.
--             Admins see everything (existing policy kept).

DROP POLICY IF EXISTS "Public can view active organizations" ON organizations;

-- Demo-only view for anonymous users
CREATE POLICY "Anonymous sees demo orgs" ON organizations
  FOR SELECT
  USING (
    auth.uid() IS NULL
    AND is_demo = true
  );

-- Active paid members see the full directory
CREATE POLICY "Active members read directory" ON organizations
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND is_active = true
    AND is_verified = true
    AND EXISTS (
      SELECT 1 FROM organizations AS my_org
      WHERE my_org.user_id = auth.uid()
        AND my_org.is_active = true
        AND my_org.payment_status IN ('paid', 'exempt')
    )
  );

-- ─── 1d. Replace public-read RLS on locations ────────────────────────────────
DROP POLICY IF EXISTS "Public read active locations" ON locations;

CREATE POLICY "Anonymous sees demo locations" ON locations
  FOR SELECT
  USING (
    auth.uid() IS NULL
    AND EXISTS (
      SELECT 1 FROM organizations o
      WHERE o.id = locations.org_id AND o.is_demo = true
    )
  );

CREATE POLICY "Active members read locations" ON locations
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND is_active = true
    AND is_verified = true
    AND EXISTS (
      SELECT 1 FROM organizations AS my_org
      WHERE my_org.user_id = auth.uid()
        AND my_org.is_active = true
        AND my_org.payment_status IN ('paid', 'exempt')
    )
  );

-- ─── 1e. Gate contacts table ─────────────────────────────────────────────────
-- Contacts are sensitive; they must never be visible to anonymous callers.
-- (This assumes a contacts table with organization_id FK.)

DO $$
BEGIN
  -- Only add if RLS is enabled on contacts
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname='contacts' AND relrowsecurity=true) THEN

    -- Drop any existing public read policy
    DROP POLICY IF EXISTS "Public read contacts" ON contacts;
    DROP POLICY IF EXISTS "Anyone reads contacts" ON contacts;

    -- Ensure active members can read contacts
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename='contacts' AND policyname='Active members read contacts'
    ) THEN
      CREATE POLICY "Active members read contacts" ON contacts
        FOR SELECT
        USING (
          auth.uid() IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM organizations AS my_org
            WHERE my_org.user_id = auth.uid()
              AND my_org.is_active = true
              AND my_org.payment_status IN ('paid', 'exempt')
          )
        );
    END IF;

    -- Org owner reads own contacts
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename='contacts' AND policyname='Org owner reads own contacts'
    ) THEN
      CREATE POLICY "Org owner reads own contacts" ON contacts
        FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM organizations o
            WHERE o.id = contacts.organization_id AND o.user_id = auth.uid()
          )
        );
    END IF;

  END IF;
END $$;

-- ─── 2. Participant tier in billing_config ────────────────────────────────────
-- Participant is the entry-level cumulative paid tier (below Collaborator).
-- Price: $0 (free for now, can be updated when decided).

INSERT INTO public.billing_config (tier, annual_price_cents, location_discount_pct, staff_seats_included, additional_staff_annual_cents)
VALUES ('participant', 0, 0, 2, 15000)
ON CONFLICT (tier) DO NOTHING;

-- ─── 3. Strengthen admin_activate_org ────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_activate_org(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_now     timestamptz := now();
  v_renewal date        := (v_now + interval '12 months')::date;
  v_org     record;
BEGIN
  -- Verify caller is a TSE admin
  IF NOT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT is_verified, agreement_signed_at, payment_status
  INTO v_org
  FROM organizations WHERE id = p_org_id;

  -- Prerequisite: verification call completed
  IF NOT v_org.is_verified THEN
    RAISE EXCEPTION 'Cannot activate: verification has not been completed';
  END IF;

  -- Prerequisite: agreement signed
  IF v_org.agreement_signed_at IS NULL THEN
    RAISE EXCEPTION 'Cannot activate: agreement has not been signed';
  END IF;

  -- Prerequisite: payment confirmed (or exempt)
  IF v_org.payment_status NOT IN ('paid', 'exempt') THEN
    RAISE EXCEPTION 'Cannot activate: payment has not been confirmed (status: %)', v_org.payment_status;
  END IF;

  UPDATE organizations
  SET
    is_active        = true,
    is_verified      = true,
    activated_at     = v_now,
    renewal_date     = v_renewal
  WHERE id = p_org_id;

  -- Activate all locations for this org
  UPDATE locations
  SET
    is_active        = true,
    is_verified      = true,
    listing_status   = 'active',
    enrollment_date  = COALESCE(enrollment_date, v_now::date)
  WHERE org_id = p_org_id;

  -- Create implementation session placeholders
  INSERT INTO implementation_sessions (org_id, session_number)
  VALUES (p_org_id, 1), (p_org_id, 2)
  ON CONFLICT (org_id, session_number) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_activate_org TO authenticated;

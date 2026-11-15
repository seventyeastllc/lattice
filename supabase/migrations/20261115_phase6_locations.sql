-- Phase 6: Locations foundation
--
-- Separates the legal/billing org from individual service sites.
-- Organizations own tier + billing; locations carry address, listing status,
-- verification history, staff seats, contacts, and services.
--
-- Migration is non-destructive: all existing org-level columns are kept.
-- A single default "Main Office" location is created for every existing org
-- using its current address/county/city/zip data.

-- ─── 1. locations table ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS locations (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name             text        NOT NULL,
  location_type    text        NOT NULL DEFAULT 'physical'
                               CHECK (location_type IN ('physical', 'virtual', 'mobile')),
  address          text,
  city             text,
  county           text,
  zip              text,
  phone            text,
  email            text,
  intake_process   text,
  is_active        boolean     NOT NULL DEFAULT true,
  is_verified      boolean     NOT NULL DEFAULT false,
  last_confirmed_at timestamptz,
  last_verified_at  timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_locations_org_id      ON locations(org_id);
CREATE INDEX IF NOT EXISTS idx_locations_county      ON locations(county);
CREATE INDEX IF NOT EXISTS idx_locations_active      ON locations(is_active, is_verified);

-- ─── 2. Backfill: one "Main Office" location per existing org ─────────────────
-- Uses the org's existing address/county data and copies its listing state.
-- last_confirmed_at and last_verified_at are org-level today; they move here.

INSERT INTO locations (
  org_id, name, location_type,
  address, city, county, zip, phone, email,
  is_active, is_verified,
  last_confirmed_at, last_verified_at,
  created_at
)
SELECT
  id,
  name || ' — Main Office',
  'physical',
  address, city, county, zip, phone, email,
  is_active, is_verified,
  last_confirmed_at, last_verified_at,
  created_at
FROM organizations
ON CONFLICT DO NOTHING;

-- ─── 3. contacts → add location_id ───────────────────────────────────────────
-- Nullable: a contact on an org with no linked location keeps working.
-- Back-fill via the new default location for each org.

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES locations(id) ON DELETE SET NULL;

UPDATE contacts c
SET    location_id = l.id
FROM   locations l
WHERE  l.org_id = c.organization_id
  AND  c.location_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_location_id ON contacts(location_id);

-- ─── 4. services → add location_id ───────────────────────────────────────────

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES locations(id) ON DELETE SET NULL;

UPDATE services s
SET    location_id = l.id
FROM   locations l
WHERE  l.org_id = s.organization_id
  AND  s.location_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_services_location_id ON services(location_id);

-- ─── 5. org_members → add location_id ────────────────────────────────────────
-- Nullable: NULL means an org-wide role (owner, global admin).
-- A non-null location_id scopes the seat to that location only.

ALTER TABLE org_members
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES locations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_org_members_location_id ON org_members(location_id);

-- ─── 6. listing_tokens → add location_id ─────────────────────────────────────
-- Keep org_id for backward compat with existing email functions.
-- location_id added for future per-location listing verification.

ALTER TABLE listing_tokens
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES locations(id) ON DELETE SET NULL;

UPDATE listing_tokens lt
SET    location_id = l.id
FROM   locations l
WHERE  l.org_id = lt.org_id
  AND  lt.location_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_listing_tokens_location_id ON listing_tokens(location_id);

-- ─── 7. Seat-usage view (read-only; no enforcement trigger yet) ───────────────
-- Open decision: DB-layer enforcement vs. application-layer.
-- For now this view lets the app check without a trigger.

CREATE OR REPLACE VIEW location_seat_usage AS
SELECT
  location_id,
  count(*) FILTER (WHERE role IN ('admin', 'member')) AS seats_used
FROM   org_members
WHERE  location_id IS NOT NULL
GROUP  BY location_id;

-- ─── 8. RLS on locations ──────────────────────────────────────────────────────

ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

-- Public can read active + verified locations (directory)
CREATE POLICY "Public read active locations"
  ON locations FOR SELECT
  USING (is_active = true AND is_verified = true);

-- Org owner reads all locations for their org
CREATE POLICY "Org owner reads own locations"
  ON locations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organizations
      WHERE id = org_id AND user_id = auth.uid()
    )
  );

-- Location members read their assigned location
CREATE POLICY "Location members read own location"
  ON locations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_members.org_id = locations.org_id
        AND org_members.location_id = locations.id
        AND org_members.user_id = auth.uid()
    )
  );

-- Org-level admins/members (location_id IS NULL) can read all locations in their org
CREATE POLICY "Org-level members read org locations"
  ON locations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_members.org_id = locations.org_id
        AND org_members.location_id IS NULL
        AND org_members.user_id = auth.uid()
    )
  );

-- Global admins read all
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'locations' AND policyname = 'Admin reads all locations'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Admin reads all locations"
        ON locations FOR SELECT
        USING (
          EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
        )
    $policy$;
  END IF;
END $$;

-- Org owner can insert/update/delete their own locations
CREATE POLICY "Org owner manages locations"
  ON locations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM organizations
      WHERE id = org_id AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organizations
      WHERE id = org_id AND user_id = auth.uid()
    )
  );

-- Global admins manage all
CREATE POLICY "Admin manages all locations"
  ON locations FOR ALL
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Grant anon SELECT on organizations.user_id so the "Org owner reads own locations"
-- policy subquery can be evaluated without a permission error.
-- user_id is a UUID; combined with RLS row filtering it exposes nothing actionable.
GRANT SELECT (id, user_id) ON organizations TO anon;

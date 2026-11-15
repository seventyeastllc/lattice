-- Phase 6b: Billing config, location-level listing status, and location reviews
--
-- Decisions applied:
--   - No free tier; participant tier is retired
--   - Per-location billing: locations 1–2 at full price, 3+ at 10% discount
--   - 4 staff seats per location; additional seats at $150/yr each (no location discount)
--   - TSE admin override allowed for seat limits (enforced at application layer)
--   - Listing confirmation moves to location level
--   - POC change → immediate pause + urgent location_review

-- ─── 1. Billing config (prices in cents; keep configurable) ───────────────────

CREATE TABLE IF NOT EXISTS billing_config (
  tier                          text        PRIMARY KEY
                                            CHECK (tier IN ('collaborator', 'strategic', 'anchor')),
  annual_price_cents            integer     NOT NULL,
  location_discount_pct         numeric(5,2) NOT NULL DEFAULT 10.00,
  staff_seats_included          integer     NOT NULL DEFAULT 4,
  additional_staff_annual_cents integer     NOT NULL DEFAULT 15000,
  updated_at                    timestamptz NOT NULL DEFAULT now()
);

-- Provisional prices. Dollar amounts remain subject to change.
INSERT INTO billing_config (tier, annual_price_cents, location_discount_pct, staff_seats_included, additional_staff_annual_cents)
VALUES
  ('collaborator', 240000, 10.00, 4, 15000),  -- $2,400 / yr, 10% off loc 3+, 4 seats, $150/additional
  ('strategic',    360000, 10.00, 4, 15000),  -- $3,600 / yr (provisional)
  ('anchor',       0,      10.00, 4, 15000)   -- custom negotiated; $0 placeholder
ON CONFLICT DO NOTHING;

ALTER TABLE billing_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin reads billing config" ON billing_config
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "Admin manages billing config" ON billing_config
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- ─── 2. Organizations: add renewal date ───────────────────────────────────────

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS renewal_date date;

-- ─── 3. Locations: enrollment fields and listing status ───────────────────────

ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS enrollment_date      date,
  ADD COLUMN IF NOT EXISTS location_sequence    integer,  -- 1=first, 2=second, 3+=discounted
  ADD COLUMN IF NOT EXISTS extra_staff_seats    integer   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS listing_status       text      NOT NULL DEFAULT 'active'
    CHECK (listing_status IN ('active', 'overdue', 'paused', 'suspended', 'pending_poc_review')),
  ADD COLUMN IF NOT EXISTS paused_at            timestamptz,
  ADD COLUMN IF NOT EXISTS paused_reason        text,
  ADD COLUMN IF NOT EXISTS suspended_at         timestamptz;

-- Back-fill enrollment_date and sequence for existing locations
-- Sequence is determined by created_at order within each org
UPDATE locations l
SET
  enrollment_date   = l.created_at::date,
  location_sequence = sub.seq
FROM (
  SELECT id, row_number() OVER (PARTITION BY org_id ORDER BY created_at) AS seq
  FROM locations
) sub
WHERE l.id = sub.id;

CREATE INDEX IF NOT EXISTS idx_locations_listing_status ON locations(listing_status);
CREATE INDEX IF NOT EXISTS idx_locations_enrollment     ON locations(org_id, location_sequence);

-- ─── 4. Location reviews (POC change, restoration, verification) ──────────────

CREATE TABLE IF NOT EXISTS location_reviews (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id        uuid        NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  org_id             uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  review_type        text        NOT NULL
    CHECK (review_type IN ('poc_change', 'restoration', 'verification')),
  priority           text        NOT NULL DEFAULT 'standard'
    CHECK (priority IN ('urgent', 'standard')),
  status             text        NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'completed', 'dismissed')),
  notes              text,
  target_completion  timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  completed_at       timestamptz,
  completed_by       uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_location_reviews_status      ON location_reviews(status);
CREATE INDEX IF NOT EXISTS idx_location_reviews_location_id ON location_reviews(location_id);
CREATE INDEX IF NOT EXISTS idx_location_reviews_priority    ON location_reviews(priority, status);

ALTER TABLE location_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manages location reviews" ON location_reviews
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- ─── 5. Seat-limit helper function ───────────────────────────────────────────
-- Returns whether a new seat can be added to a location.
-- TSE admin override: callers with admin role bypass the check in application code.
-- This function is advisory; no DB-layer trigger enforces it.

CREATE OR REPLACE FUNCTION check_location_seat_available(p_location_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    COALESCE((
      SELECT bc.staff_seats_included
      FROM billing_config bc
      JOIN organizations o ON o.membership_tier = bc.tier
      JOIN locations l ON l.org_id = o.id
      WHERE l.id = p_location_id
    ), 4) >
    COALESCE((
      SELECT seats_used FROM location_seat_usage WHERE location_id = p_location_id
    ), 0);
$$;

-- ─── 6. Grant the function to authenticated role ──────────────────────────────
GRANT EXECUTE ON FUNCTION check_location_seat_available TO authenticated;

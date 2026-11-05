-- Claim flow migration
-- Run in Supabase SQL Editor

-- 1. Track claim state on prm_leads
ALTER TABLE prm_leads
  ADD COLUMN IF NOT EXISTS claimed_by_email   text,
  ADD COLUMN IF NOT EXISTS claimed_at         timestamptz,
  ADD COLUMN IF NOT EXISTS claim_status       text DEFAULT 'unclaimed'
    CHECK (claim_status IN ('unclaimed', 'pending', 'approved', 'rejected'));

-- 2. Track which lead an org was claimed from
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS claimed_lead_id text REFERENCES prm_leads(record_id) ON DELETE SET NULL;

-- 3. Index for fast claim lookups
CREATE INDEX IF NOT EXISTS idx_prm_leads_claim_status ON prm_leads(claim_status);
CREATE INDEX IF NOT EXISTS idx_orgs_claimed_lead      ON organizations(claimed_lead_id);

-- 4. Full-text search index on org_name + county for the claim search bar
CREATE INDEX IF NOT EXISTS idx_prm_leads_name_search
  ON prm_leads USING gin(to_tsvector('english', coalesce(org_name,'') || ' ' || coalesce(county,'') || ' ' || coalesce(email,'')));

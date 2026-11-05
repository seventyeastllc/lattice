-- ─── PRM Leads Table ────────────────────────────────────────────────────────
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New Query)

CREATE TABLE IF NOT EXISTS prm_leads (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id            text UNIQUE NOT NULL,          -- TSE-XXXX
  org_name             text NOT NULL,
  dba_name             text,
  source_doc           text,

  -- Location
  street_address       text,
  city                 text,
  state                text DEFAULT 'GA',
  zip                  text,
  county               text,
  service_area         text,
  coc_status           text,
  coc_name             text,
  coc_county_class     text,

  -- Contact
  contact_name         text,
  contact_title        text,
  main_phone           text,
  direct_phone         text,
  email                text,
  website              text,
  facebook             text,
  instagram            text,

  -- Services
  primary_category     text,
  sub_category         text,
  service_tags         text,
  population_served    text,
  eligibility_notes    text,

  -- Operations
  hours                text,
  fees                 text,
  referral_required    boolean,
  intake_process       text,
  required_docs        text,

  -- CRM Tracking
  partnership_status   text DEFAULT 'Prospect',
  priority             text DEFAULT 'Medium',
  relationship_owner   text,
  contact_info_valid   text DEFAULT 'Needs Verification',
  date_added           date,
  date_last_verified   date,
  last_contact_date    date,
  last_contact_method  text,
  follow_up_notes      text,
  next_follow_up_date  date,

  -- Vetting
  duplicate_flag       boolean DEFAULT false,
  duplicate_of         text,
  verified_active      text DEFAULT 'Unverified',
  data_quality_flag    text,
  issues_notes         text,

  -- Outreach
  tse_invite_contact   text,

  -- Directory promotion
  promoted_to_directory boolean DEFAULT false,
  organization_id      uuid REFERENCES organizations(id) ON DELETE SET NULL,

  -- Timestamps
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

-- Row-level security: admin and staff only
ALTER TABLE prm_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prm_admin_staff" ON prm_leads
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'staff')
    )
  );

-- Indexes for common filters
CREATE INDEX IF NOT EXISTS prm_leads_status_idx   ON prm_leads(partnership_status);
CREATE INDEX IF NOT EXISTS prm_leads_county_idx   ON prm_leads(county);
CREATE INDEX IF NOT EXISTS prm_leads_category_idx ON prm_leads(primary_category);
CREATE INDEX IF NOT EXISTS prm_leads_followup_idx ON prm_leads(next_follow_up_date);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_prm_leads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prm_leads_updated_at
  BEFORE UPDATE ON prm_leads
  FOR EACH ROW EXECUTE FUNCTION update_prm_leads_updated_at();

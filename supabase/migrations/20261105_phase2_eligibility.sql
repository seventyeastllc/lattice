-- Phase 2: Eligibility & Access Intelligence columns
-- All columns are nullable with safe defaults — non-breaking addition

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS website                text,
  ADD COLUMN IF NOT EXISTS eligibility_summary    text,
  ADD COLUMN IF NOT EXISTS documentation_required text,
  ADD COLUMN IF NOT EXISTS intake_process         text,
  ADD COLUMN IF NOT EXISTS appointment_required   boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS languages_served       text[],
  ADD COLUMN IF NOT EXISTS service_area_counties  text[],
  ADD COLUMN IF NOT EXISTS year_established       integer,
  ADD COLUMN IF NOT EXISTS last_verified_at       timestamptz;

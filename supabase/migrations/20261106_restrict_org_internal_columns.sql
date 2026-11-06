-- Restrict internal billing/CRM columns on organizations from anonymous access.
--
-- Background: the public SELECT RLS policy (is_active = true AND is_verified = true)
-- controls which ROWS anonymous visitors see, but PostgreSQL RLS does not restrict
-- columns. The anon role had blanket SELECT on all columns, exposing
-- payment_status, membership_tier, and claimed_lead_id to any visitor.
--
-- Fix: revoke blanket column access from anon, then re-grant only the columns
-- that have a legitimate public purpose. The authenticated role (members, admins)
-- retains full column access so the admin panel is unaffected.

-- Step 1: Remove blanket SELECT access from the anon role.
REVOKE SELECT ON organizations FROM anon;

-- Step 2: Re-grant only public-purpose columns.
-- Excluded: payment_status, membership_tier (billing), claimed_lead_id (CRM import ref).
-- phone / email omitted — contact info is already accessible through the contacts
-- table, which has its own policy (contacts of active orgs are readable by anon).
GRANT SELECT (
  id,
  name,
  slug,
  description,
  org_type,
  tier,
  website,
  county,
  city,
  zip,
  address,
  is_active,
  is_verified,
  has_funding_available,
  eligibility_summary,
  documentation_required,
  intake_process,
  appointment_required,
  languages_served,
  service_area_counties,
  year_established,
  last_verified_at,
  created_at,
  updated_at
) ON organizations TO anon;

-- Phase 10b: Confirm tier → benefit level mapping (tiers numbered 1, 2, 3)
-- Founder decision: no tier display names yet — use Tier 1 / Tier 2 / Tier 3
-- Internal slugs (collaborator, strategic, anchor) are preserved as PKs/FKs.
-- Mapping: collaborator → level 1, strategic → level 2, anchor → level 3

-- =============================================================================
-- 1. Add display_name to billing_config
-- =============================================================================

ALTER TABLE billing_config
  ADD COLUMN IF NOT EXISTS display_name text;

UPDATE billing_config SET display_name = 'Tier 1' WHERE tier = 'collaborator';
UPDATE billing_config SET display_name = 'Tier 2' WHERE tier = 'strategic';
UPDATE billing_config SET display_name = 'Tier 3' WHERE tier = 'anchor';

-- =============================================================================
-- 2. Set benefit_level_id (confirmed mapping)
-- =============================================================================

UPDATE billing_config SET benefit_level_id = 1 WHERE tier = 'collaborator';
UPDATE billing_config SET benefit_level_id = 2 WHERE tier = 'strategic';
UPDATE billing_config SET benefit_level_id = 3 WHERE tier = 'anchor';
-- participant and any other non-paid tiers remain NULL

-- =============================================================================
-- 3. Correct annual service quantities to approved values
-- These drive future calls to admin_enroll_location_service_allowances.
-- Existing service_allowances rows are NOT retroactively changed (never reduce
-- legitimate grants). Reconcile any test-value rows separately if needed.
-- =============================================================================

UPDATE billing_config
SET
  annual_request_reviews    = 2,
  annual_curated_intros     = 0,
  annual_facilitated_sessions = 0
WHERE tier = 'collaborator';

UPDATE billing_config
SET
  annual_request_reviews    = 2,
  annual_curated_intros     = 4,
  annual_facilitated_sessions = 0
WHERE tier = 'strategic';

UPDATE billing_config
SET
  annual_request_reviews    = 2,
  annual_curated_intros     = 4,
  annual_facilitated_sessions = 2
WHERE tier = 'anchor';

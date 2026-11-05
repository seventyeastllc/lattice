-- Listing confirmation tokens + tracking columns
-- Run in Supabase SQL Editor

-- Track when orgs last confirmed their listing
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS last_confirmed_at     timestamptz,
  ADD COLUMN IF NOT EXISTS last_login_confirm_at timestamptz;

-- One-time tokens for no-login confirmation emails
CREATE TABLE IF NOT EXISTS listing_tokens (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  token           text NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  expires_at      timestamptz NOT NULL DEFAULT now() + interval '5 days',
  used_at         timestamptz,
  requires_login  boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listing_tokens_token  ON listing_tokens(token);
CREATE INDEX IF NOT EXISTS idx_listing_tokens_org    ON listing_tokens(org_id);

-- RLS: edge function uses service role, no public access needed
ALTER TABLE listing_tokens ENABLE ROW LEVEL SECURITY;

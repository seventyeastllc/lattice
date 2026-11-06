-- Phase 3: saved_resources table for member bookmarks
CREATE TABLE IF NOT EXISTS saved_resources (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, organization_id)
);

-- RLS: users can only read and write their own saves
ALTER TABLE saved_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own saves"
  ON saved_resources FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own saves"
  ON saved_resources FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own saves"
  ON saved_resources FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS saved_resources_user_id_idx ON saved_resources(user_id);
CREATE INDEX IF NOT EXISTS saved_resources_org_id_idx ON saved_resources(organization_id);

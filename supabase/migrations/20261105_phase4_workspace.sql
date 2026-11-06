-- Phase 4: Collections for saved resources
CREATE TABLE IF NOT EXISTS resource_collections (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE resource_collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own collections" ON resource_collections
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Junction: saved_resources can belong to collections
CREATE TABLE IF NOT EXISTS collection_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id   uuid NOT NULL REFERENCES resource_collections(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  added_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE(collection_id, organization_id)
);

ALTER TABLE collection_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own collection items" ON collection_items
  FOR ALL USING (
    auth.uid() = (SELECT user_id FROM resource_collections WHERE id = collection_id)
  ) WITH CHECK (
    auth.uid() = (SELECT user_id FROM resource_collections WHERE id = collection_id)
  );

-- Tools & Knowledge library
CREATE TABLE IF NOT EXISTS knowledge_resources (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL,
  description  text,
  category     text NOT NULL CHECK (category IN ('templates_checklists','navigation_guides','learning_resources','playbooks')),
  url          text,
  is_published boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE knowledge_resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read published resources" ON knowledge_resources
  FOR SELECT USING (auth.role() = 'authenticated' AND is_published = true);
CREATE POLICY "Service role manages resources" ON knowledge_resources
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS knowledge_resources_category_idx ON knowledge_resources(category);
CREATE INDEX IF NOT EXISTS knowledge_resources_published_idx ON knowledge_resources(is_published);

-- Sample knowledge resources (dev content)
INSERT INTO knowledge_resources (title, description, category, url, is_published) VALUES
  ('Referral Coordination Checklist', 'A step-by-step checklist for coordinating referrals between organizations — covering intake, eligibility confirmation, warm handoff, and follow-up.', 'templates_checklists', NULL, true),
  ('Housing Stability Navigator Guide', 'An overview of housing stability pathways, eligibility thresholds, and documentation requirements across Georgia providers.', 'navigation_guides', NULL, true),
  ('Understanding Coordinated Entry', 'An introduction to coordinated entry systems, how organizations participate, and what it means for access to housing resources.', 'learning_resources', NULL, true),
  ('Community Coordination Playbook', 'A practical guide for organizations building cross-sector partnerships — covering roles, communication protocols, and shared outcomes.', 'playbooks', NULL, true),
  ('Eligibility Documentation Template', 'A reusable template for documenting client eligibility across common service categories.', 'templates_checklists', NULL, true),
  ('Benefits Navigation Quick Reference', 'A quick-reference card covering major benefit programs, income thresholds, and how to help clients access each.', 'navigation_guides', NULL, true)
ON CONFLICT DO NOTHING;

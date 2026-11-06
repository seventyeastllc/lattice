-- Phase 5a: network_announcements table
CREATE TABLE IF NOT EXISTS network_announcements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text,
  body        text NOT NULL,
  is_published boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE network_announcements ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read published announcements
CREATE POLICY "Members can read published announcements"
  ON network_announcements FOR SELECT
  TO authenticated
  USING (is_published = true);

-- Admin can read all
CREATE POLICY "Admin can read all announcements"
  ON network_announcements FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
        AND (auth.users.raw_user_meta_data->>'role') = 'admin'
    )
  );

CREATE POLICY "Admin can insert announcements"
  ON network_announcements FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
        AND (auth.users.raw_user_meta_data->>'role') = 'admin'
    )
  );

CREATE POLICY "Admin can update announcements"
  ON network_announcements FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
        AND (auth.users.raw_user_meta_data->>'role') = 'admin'
    )
  );

CREATE POLICY "Admin can delete announcements"
  ON network_announcements FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
        AND (auth.users.raw_user_meta_data->>'role') = 'admin'
    )
  );

-- Seed two initial announcements
INSERT INTO network_announcements (title, body, is_published) VALUES
  (
    'Welcome to Lattice',
    'Lattice is now in private development. Thank you for being part of the founding network.',
    true
  ),
  (
    'Directory updates',
    'New resource profiles are being added. Explore the directory and save organizations to your workspace.',
    true
  );

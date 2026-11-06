-- Phase 5a: Admin RLS policy for knowledge_resources
-- Allows admin role to insert, update, delete knowledge resources

CREATE POLICY "Admin can insert knowledge_resources"
  ON knowledge_resources FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
        AND (auth.users.raw_user_meta_data->>'role') = 'admin'
    )
  );

CREATE POLICY "Admin can update knowledge_resources"
  ON knowledge_resources FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
        AND (auth.users.raw_user_meta_data->>'role') = 'admin'
    )
  );

CREATE POLICY "Admin can delete knowledge_resources"
  ON knowledge_resources FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
        AND (auth.users.raw_user_meta_data->>'role') = 'admin'
    )
  );

-- Run this in the Supabase SQL Editor AFTER schema.sql

-- Allow anonymous connection request submissions (requester info goes in notes)
create policy "Anyone can submit connection request" on connection_requests
  for insert with check (true);

-- Allow partner applications to be submitted as unverified/inactive orgs
create policy "Anyone can apply to join" on organizations
  for insert with check (is_active = false and is_verified = false);

-- Allow contact info to be submitted alongside an application
create policy "Anyone can add contact" on contacts
  for insert with check (true);

-- Admin: full read access to all organizations (including unverified/pending)
create policy "Admin can view all organizations" on organizations
  for select using (
    exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin')
  );

-- Admin: can approve/reject/update organizations
create policy "Admin can update organizations" on organizations
  for update using (
    exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin')
  );

-- Admin: full read access to all connection requests
create policy "Admin can view all connection requests" on connection_requests
  for select using (
    exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin')
  );

-- Admin: can advance connection request status
create policy "Admin can update connection requests" on connection_requests
  for update using (
    exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin')
  );

-- Admin: full read access to all contacts
create policy "Admin can view all contacts" on contacts
  for select using (
    exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin')
  );

-- Admin: can update contacts
create policy "Admin can update contacts" on contacts
  for update using (
    exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin')
  );

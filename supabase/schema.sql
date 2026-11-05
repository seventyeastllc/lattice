-- Organizations (partner agencies in the Lattice network)
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  description text,
  org_type text check (org_type in ('nonprofit','faith_based','school','medical','housing','government','other')),
  tier text check (tier in ('participant','collaborator','strategic','anchor')),
  website text,
  phone text,
  email text,
  address text,
  city text,
  county text,
  zip text,
  is_active boolean default true,
  is_verified boolean default false,
  has_funding_available boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Named contacts at each organization (the real person to call)
create table contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  full_name text not null,
  title text,
  email text,
  phone text,
  is_primary boolean default false,
  accepts_case_conference boolean default false,
  created_at timestamptz default now()
);

-- Services each organization offers
create table services (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  category text check (category in ('housing_stability','income_benefits','health_wellness','life_navigation')),
  name text not null,
  description text,
  eligibility_notes text,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- User profiles (linked to Supabase auth)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  organization_id uuid references organizations(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Roles stored separately from profiles for security
create table user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  role text check (role in ('admin','staff','org_admin','member')) not null,
  created_at timestamptz default now(),
  unique(user_id, role)
);

-- Connection requests (routes to TSE staff, not directly to partner agencies)
create table connection_requests (
  id uuid primary key default gen_random_uuid(),
  requesting_user_id uuid references auth.users(id),
  target_organization_id uuid references organizations(id),
  target_contact_id uuid references contacts(id),
  request_type text check (request_type in ('facilitated_connection','case_conference','information_only')),
  notes text,
  status text check (status in ('pending','active','resolved','closed')) default 'pending',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS on all tables
alter table organizations enable row level security;
alter table contacts enable row level security;
alter table services enable row level security;
alter table profiles enable row level security;
alter table user_roles enable row level security;
alter table connection_requests enable row level security;

-- RLS policies: public can read active verified organizations and their services/contacts
create policy "Public can view active organizations" on organizations for select using (is_active = true and is_verified = true);
create policy "Public can view contacts of active orgs" on contacts for select using (exists (select 1 from organizations o where o.id = organization_id and o.is_active = true and o.is_verified = true));
create policy "Public can view services of active orgs" on services for select using (exists (select 1 from organizations o where o.id = organization_id and o.is_active = true) and is_active = true);

-- Authenticated users can view their own profile and roles
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
create policy "Users can view own roles" on user_roles for select using (auth.uid() = user_id);

-- Authenticated users can create connection requests
create policy "Authenticated users can create connection requests" on connection_requests for insert with check (auth.uid() = requesting_user_id);
create policy "Users can view own connection requests" on connection_requests for select using (auth.uid() = requesting_user_id);

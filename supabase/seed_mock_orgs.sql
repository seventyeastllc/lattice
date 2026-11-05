-- 15 mock directory organizations for Lattice
-- Paste into Supabase SQL Editor and run.
-- Safe to re-run: uses ON CONFLICT (slug) DO NOTHING on orgs.

DO $$
DECLARE
  org_id uuid;
BEGIN

  -- 1. Cherokee County Supportive Housing
  INSERT INTO organizations (name, slug, org_type, county, description, is_active, is_verified, has_funding_available)
  VALUES ('Cherokee County Supportive Housing', 'cherokee-supportive-housing', 'nonprofit', 'Cherokee',
    'Provides rapid rehousing, eviction prevention, and transitional housing resources across Cherokee County.', true, true, true)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO org_id;
  IF org_id IS NOT NULL THEN
    INSERT INTO contacts (organization_id, full_name, title, phone, is_primary, accepts_case_conference)
    VALUES (org_id, 'Sandra Tillman', 'Housing Coordinator', '(678) 555-0101', true, true);
    INSERT INTO services (organization_id, name, category, is_active)
    VALUES (org_id, 'Housing & Stability', 'housing_stability', true),
           (org_id, 'Income & Benefits', 'income_benefits', true);
  END IF;

  -- 2. Bartow Interfaith Coalition
  INSERT INTO organizations (name, slug, org_type, county, description, is_active, is_verified, has_funding_available)
  VALUES ('Bartow Interfaith Coalition', 'bartow-interfaith', 'faith_based', 'Bartow',
    'A network of 14 congregations coordinating emergency assistance, food access, and crisis support in Bartow County.', true, true, false)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO org_id;
  IF org_id IS NOT NULL THEN
    INSERT INTO contacts (organization_id, full_name, title, phone, is_primary, accepts_case_conference)
    VALUES (org_id, 'Rev. Calvin Price', 'Outreach Coordinator', '(770) 555-0214', true, true);
    INSERT INTO services (organization_id, name, category, is_active)
    VALUES (org_id, 'Life Navigation', 'life_navigation', true),
           (org_id, 'Income & Benefits', 'income_benefits', true);
  END IF;

  -- 3. Carroll County School District — Family Liaison Office
  INSERT INTO organizations (name, slug, org_type, county, description, is_active, is_verified, has_funding_available)
  VALUES ('Carroll County Schools — Family Liaison Office', 'carroll-schools-family', 'school', 'Carroll',
    'School-based family liaisons connecting students experiencing homelessness or instability to district and community resources.', true, true, false)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO org_id;
  IF org_id IS NOT NULL THEN
    INSERT INTO contacts (organization_id, full_name, title, phone, is_primary, accepts_case_conference)
    VALUES (org_id, 'Keisha Dotson', 'Family Liaison Supervisor', '(770) 555-0317', true, true);
    INSERT INTO services (organization_id, name, category, is_active)
    VALUES (org_id, 'Life Navigation', 'life_navigation', true);
  END IF;

  -- 4. Haralson County Health Department
  INSERT INTO organizations (name, slug, org_type, county, description, is_active, is_verified, has_funding_available)
  VALUES ('Haralson County Health Department', 'haralson-health', 'government', 'Haralson',
    'County public health services including maternal care, chronic disease management, and social determinants screenings.', true, true, false)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO org_id;
  IF org_id IS NOT NULL THEN
    INSERT INTO contacts (organization_id, full_name, title, phone, is_primary, accepts_case_conference)
    VALUES (org_id, 'Dr. Pamela Whitfield', 'Public Health Director', '(770) 555-0409', true, false);
    INSERT INTO services (organization_id, name, category, is_active)
    VALUES (org_id, 'Health & Wellness', 'health_wellness', true);
  END IF;

  -- 5. Smyrna Housing Authority
  INSERT INTO organizations (name, slug, org_type, county, description, is_active, is_verified, has_funding_available)
  VALUES ('Smyrna Housing Authority', 'smyrna-housing-authority', 'housing', 'Cobb',
    'Manages affordable housing programs and Section 8 voucher coordination for low-income residents in Cobb County.', true, true, true)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO org_id;
  IF org_id IS NOT NULL THEN
    INSERT INTO contacts (organization_id, full_name, title, phone, is_primary, accepts_case_conference)
    VALUES (org_id, 'Terrence Holt', 'Housing Programs Manager', '(770) 555-0512', true, true);
    INSERT INTO services (organization_id, name, category, is_active)
    VALUES (org_id, 'Housing & Stability', 'housing_stability', true);
  END IF;

  -- 6. Northwest Georgia Community Action Council
  INSERT INTO organizations (name, slug, org_type, county, description, is_active, is_verified, has_funding_available)
  VALUES ('NW Georgia Community Action Council', 'nwga-community-action', 'nonprofit', 'Floyd',
    'Anti-poverty agency serving 9 northwest Georgia counties with utility assistance, LIHEAP, and workforce readiness programs.', true, true, true)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO org_id;
  IF org_id IS NOT NULL THEN
    INSERT INTO contacts (organization_id, full_name, title, phone, is_primary, accepts_case_conference)
    VALUES (org_id, 'Angela Pearson', 'Client Services Director', '(706) 555-0618', true, true);
    INSERT INTO services (organization_id, name, category, is_active)
    VALUES (org_id, 'Income & Benefits', 'income_benefits', true),
           (org_id, 'Housing & Stability', 'housing_stability', true);
  END IF;

  -- 7. Cartersville Mercy Clinic
  INSERT INTO organizations (name, slug, org_type, county, description, is_active, is_verified, has_funding_available)
  VALUES ('Cartersville Mercy Clinic', 'cartersville-mercy-clinic', 'medical', 'Bartow',
    'Free and reduced-cost primary care and behavioral health services for uninsured adults in Bartow and surrounding counties.', true, true, true)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO org_id;
  IF org_id IS NOT NULL THEN
    INSERT INTO contacts (organization_id, full_name, title, phone, is_primary, accepts_case_conference)
    VALUES (org_id, 'Dr. Michelle Torres', 'Medical Director', '(770) 555-0721', true, true);
    INSERT INTO services (organization_id, name, category, is_active)
    VALUES (org_id, 'Health & Wellness', 'health_wellness', true);
  END IF;

  -- 8. Kennesaw Mountain Area Ministries
  INSERT INTO organizations (name, slug, org_type, county, description, is_active, is_verified, has_funding_available)
  VALUES ('Kennesaw Mountain Area Ministries', 'kmam', 'faith_based', 'Cobb',
    'Collaborative ministry network providing emergency food, utility assistance, and transitional support in north Cobb County.', true, true, false)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO org_id;
  IF org_id IS NOT NULL THEN
    INSERT INTO contacts (organization_id, full_name, title, phone, is_primary, accepts_case_conference)
    VALUES (org_id, 'Pastor Ruth Abernathy', 'Network Coordinator', '(678) 555-0824', true, true);
    INSERT INTO services (organization_id, name, category, is_active)
    VALUES (org_id, 'Life Navigation', 'life_navigation', true),
           (org_id, 'Income & Benefits', 'income_benefits', true);
  END IF;

  -- 9. Paulding DFCS
  INSERT INTO organizations (name, slug, org_type, county, description, is_active, is_verified, has_funding_available)
  VALUES ('Paulding County DFCS', 'paulding-dfcs', 'government', 'Paulding',
    'County Division of Family and Children Services administering food stamps, Medicaid, TANF, and foster care programs.', true, true, false)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO org_id;
  IF org_id IS NOT NULL THEN
    INSERT INTO contacts (organization_id, full_name, title, phone, is_primary, accepts_case_conference)
    VALUES (org_id, 'LaShonda Freeman', 'Benefits Supervisor', '(770) 555-0930', true, false);
    INSERT INTO services (organization_id, name, category, is_active)
    VALUES (org_id, 'Income & Benefits', 'income_benefits', true);
  END IF;

  -- 10. Grace Place Douglas County
  INSERT INTO organizations (name, slug, org_type, county, description, is_active, is_verified, has_funding_available)
  VALUES ('Grace Place Douglas County', 'grace-place-douglas', 'faith_based', 'Douglas',
    'Comprehensive family resource center offering food pantry, job readiness, financial coaching, and after-school tutoring.', true, true, false)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO org_id;
  IF org_id IS NOT NULL THEN
    INSERT INTO contacts (organization_id, full_name, title, phone, is_primary, accepts_case_conference)
    VALUES (org_id, 'Minister James Booker', 'Family Services Lead', '(770) 555-1034', true, true);
    INSERT INTO services (organization_id, name, category, is_active)
    VALUES (org_id, 'Life Navigation', 'life_navigation', true),
           (org_id, 'Income & Benefits', 'income_benefits', true);
  END IF;

  -- 11. Horizon Behavioral Health — Cherokee
  INSERT INTO organizations (name, slug, org_type, county, description, is_active, is_verified, has_funding_available)
  VALUES ('Horizon Behavioral Health — Cherokee', 'horizon-behavioral-cherokee', 'medical', 'Cherokee',
    'Outpatient mental health and substance use treatment with case management and crisis stabilization services.', true, true, true)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO org_id;
  IF org_id IS NOT NULL THEN
    INSERT INTO contacts (organization_id, full_name, title, phone, is_primary, accepts_case_conference)
    VALUES (org_id, 'Dr. Kara Simmons', 'Clinical Director', '(678) 555-1138', true, true);
    INSERT INTO services (organization_id, name, category, is_active)
    VALUES (org_id, 'Health & Wellness', 'health_wellness', true),
           (org_id, 'Life Navigation', 'life_navigation', true);
  END IF;

  -- 12. Acworth Community Outreach
  INSERT INTO organizations (name, slug, org_type, county, description, is_active, is_verified, has_funding_available)
  VALUES ('Acworth Community Outreach', 'acworth-outreach', 'nonprofit', 'Cobb',
    'Grassroots neighbors-helping-neighbors network providing emergency food, household goods, and warm referrals across northwest Cobb.', true, true, false)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO org_id;
  IF org_id IS NOT NULL THEN
    INSERT INTO contacts (organization_id, full_name, title, phone, is_primary, accepts_case_conference)
    VALUES (org_id, 'Denise Kwan', 'Volunteer Coordinator', '(770) 555-1241', true, false);
    INSERT INTO services (organization_id, name, category, is_active)
    VALUES (org_id, 'Income & Benefits', 'income_benefits', true);
  END IF;

  -- 13. Highland Rivers Health — Polk County
  INSERT INTO organizations (name, slug, org_type, county, description, is_active, is_verified, has_funding_available)
  VALUES ('Highland Rivers Health — Polk', 'highland-rivers-polk', 'medical', 'Polk',
    'Community mental health center offering therapy, psychiatric services, and integrated primary care for adults and youth.', true, true, false)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO org_id;
  IF org_id IS NOT NULL THEN
    INSERT INTO contacts (organization_id, full_name, title, phone, is_primary, accepts_case_conference)
    VALUES (org_id, 'Marcus Jennings', 'Community Liaison', '(770) 555-1345', true, true);
    INSERT INTO services (organization_id, name, category, is_active)
    VALUES (org_id, 'Health & Wellness', 'health_wellness', true);
  END IF;

  -- 14. Cobb County Department of Community Development
  INSERT INTO organizations (name, slug, org_type, county, description, is_active, is_verified, has_funding_available)
  VALUES ('Cobb County Community Development', 'cobb-community-dev', 'government', 'Cobb',
    'Administers CDBG and HOME grants, affordable housing development, and neighborhood revitalization programs in Cobb County.', true, true, true)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO org_id;
  IF org_id IS NOT NULL THEN
    INSERT INTO contacts (organization_id, full_name, title, phone, is_primary, accepts_case_conference)
    VALUES (org_id, 'Patricia Nguyen', 'Grants Program Manager', '(770) 555-1449', true, false);
    INSERT INTO services (organization_id, name, category, is_active)
    VALUES (org_id, 'Housing & Stability', 'housing_stability', true),
           (org_id, 'Income & Benefits', 'income_benefits', true);
  END IF;

  -- 15. Pathway Home — Transitional Housing
  INSERT INTO organizations (name, slug, org_type, county, description, is_active, is_verified, has_funding_available)
  VALUES ('Pathway Home — Transitional Housing', 'pathway-home', 'housing', 'Douglas',
    'Provides 6-to-18-month transitional housing with wraparound case management for individuals exiting homelessness or incarceration.', true, true, true)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO org_id;
  IF org_id IS NOT NULL THEN
    INSERT INTO contacts (organization_id, full_name, title, phone, is_primary, accepts_case_conference)
    VALUES (org_id, 'Dwayne Carter', 'Program Director', '(770) 555-1552', true, true);
    INSERT INTO services (organization_id, name, category, is_active)
    VALUES (org_id, 'Housing & Stability', 'housing_stability', true),
           (org_id, 'Life Navigation', 'life_navigation', true);
  END IF;

END $$;

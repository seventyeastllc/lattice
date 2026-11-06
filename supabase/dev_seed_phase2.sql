-- Phase 2 dev seed: illustrative eligibility & access data
-- TSE should review and update with accurate information before public launch
-- These updates only apply to rows that match the WHERE clause — no rows are created

UPDATE organizations SET
  website = 'https://nwgahousing.org',
  eligibility_summary = 'Must be a Floyd, Gordon, or Polk County resident. Income at or below 80% AMI. Priority given to households facing imminent eviction or utility shutoff.',
  documentation_required = 'Photo ID, proof of residency (utility bill or lease), proof of income (pay stubs or benefits letter), eviction notice or utility shutoff notice if applicable.',
  intake_process = 'Walk-in Monday through Friday, 9am–4pm. No appointment required for initial screening. Case management appointments scheduled same-day when available.',
  appointment_required = false,
  languages_served = ARRAY['English', 'Spanish'],
  service_area_counties = ARRAY['Floyd', 'Gordon', 'Polk'],
  last_verified_at = NOW()
WHERE id = (
  SELECT id FROM organizations
  WHERE name ILIKE '%housing%' AND county ILIKE '%Floyd%'
  AND is_verified = true
  LIMIT 1
);

UPDATE organizations SET
  eligibility_summary = 'Open to all residents of the 15-county Northwest Georgia region. No income requirements for food pantry. Emergency rental assistance requires income verification.',
  documentation_required = 'Photo ID required. For rental assistance: proof of income, copy of lease, and landlord contact information.',
  intake_process = 'Food pantry: walk-in Tuesdays and Thursdays 10am–1pm. Rental assistance: call ahead to schedule an intake appointment.',
  appointment_required = false,
  languages_served = ARRAY['English'],
  service_area_counties = ARRAY['Floyd', 'Gordon', 'Bartow', 'Walker', 'Catoosa', 'Whitfield', 'Murray', 'Chattooga', 'Polk', 'Dade', 'Haralson', 'Paulding', 'Cherokee', 'Pickens', 'Gilmer'],
  last_verified_at = NOW()
WHERE id = (
  SELECT id FROM organizations
  WHERE name ILIKE '%community%' AND is_verified = true
  LIMIT 1
);

UPDATE organizations SET
  eligibility_summary = 'Serves students and families enrolled in Floyd County Schools. Some programs open to all county residents — contact for details.',
  documentation_required = 'School enrollment verification for student-focused programs. No documentation required for community programs.',
  intake_process = 'Contact the school social worker directly. Community programs are announced on the school district website.',
  appointment_required = true,
  languages_served = ARRAY['English', 'Spanish'],
  service_area_counties = ARRAY['Floyd'],
  last_verified_at = NOW()
WHERE id = (
  SELECT id FROM organizations
  WHERE org_type = 'school' AND is_verified = true
  LIMIT 1
);

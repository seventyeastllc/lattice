// Run with: node supabase/seed.mjs
// Seeds the 6 sample organizations into Supabase.
// Requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env
// NOTE: The anon key can only insert if RLS allows it.
// If you hit permission errors, run this SQL in the Supabase dashboard first:
//   create policy "Service can insert orgs" on organizations for insert with check (true);
//   create policy "Service can insert contacts" on contacts for insert with check (true);
//   create policy "Service can insert services" on services for insert with check (true);
// Then drop those policies after seeding.

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(resolve(__dirname, "../.env"), "utf8")
  .split("\n")
  .filter((l) => l.includes("="))
  .reduce((acc, l) => {
    const [k, ...v] = l.split("=");
    acc[k.trim()] = v.join("=").trim();
    return acc;
  }, {});

const SUPABASE_URL = env["VITE_SUPABASE_URL"];
const SUPABASE_KEY = env["VITE_SUPABASE_ANON_KEY"];

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env");
  process.exit(1);
}

async function rpc(table, body, method = "POST") {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${table}: ${JSON.stringify(json)}`);
  return json;
}

const orgs = [
  {
    org: { name: "Cobb Community Organizations in Action", slug: "coia", org_type: "nonprofit", county: "Cobb", description: "Connects low-income Cobb County residents to emergency financial assistance, housing support, and community resources.", is_active: true, is_verified: true, has_funding_available: true },
    contact: { full_name: "Marcus Webb", title: "Housing Navigator", phone: "(770) 555-0142", is_primary: true, accepts_case_conference: true },
    services: [
      { name: "Housing & Stability", category: "housing_stability", is_active: true },
      { name: "Income & Benefits", category: "income_benefits", is_active: true },
    ],
  },
  {
    org: { name: "New Hope Community Church", slug: "new-hope", org_type: "faith_based", county: "Cobb", description: "Faith-based community support offering emergency assistance, food access, and life navigation services rooted in relational care.", is_active: true, is_verified: true, has_funding_available: false },
    contact: { full_name: "Pastor Diane Okafor", title: "Community Liaison", phone: "(770) 555-0187", is_primary: true, accepts_case_conference: true },
    services: [
      { name: "Life Navigation", category: "life_navigation", is_active: true },
      { name: "Income & Benefits", category: "income_benefits", is_active: true },
    ],
  },
  {
    org: { name: "Marietta City Schools — Student Services", slug: "marietta-schools", org_type: "school", county: "Cobb", description: "School-based social work team supporting students and families navigating housing instability, attendance barriers, and access to community resources.", is_active: true, is_verified: true, has_funding_available: false },
    contact: { full_name: "Tanya Reeves", title: "Lead Social Worker", phone: "(770) 555-0231", is_primary: true, accepts_case_conference: true },
    services: [
      { name: "Life Navigation", category: "life_navigation", is_active: true },
    ],
  },
  {
    org: { name: "WellStar Community Health", slug: "wellstar", org_type: "medical", county: "Cobb", description: "Community health navigation connecting patients to healthcare access, benefits enrollment, and social determinants of health support.", is_active: true, is_verified: true, has_funding_available: true },
    contact: { full_name: "Jerome Pittman", title: "Patient Navigator", phone: "(770) 555-0309", is_primary: true, accepts_case_conference: false },
    services: [
      { name: "Health & Wellness", category: "health_wellness", is_active: true },
    ],
  },
  {
    org: { name: "Paulding County Family Services", slug: "paulding-family", org_type: "nonprofit", county: "Paulding", description: "Comprehensive family stabilization services including housing assistance, benefits navigation, and case coordination for families in crisis.", is_active: true, is_verified: true, has_funding_available: true },
    contact: { full_name: "Alicia Moreno", title: "Case Coordination Supervisor", phone: "(770) 555-0418", is_primary: true, accepts_case_conference: true },
    services: [
      { name: "Housing & Stability", category: "housing_stability", is_active: true },
      { name: "Income & Benefits", category: "income_benefits", is_active: true },
    ],
  },
  {
    org: { name: "Sixth Day Ministries", slug: "sixth-day", org_type: "faith_based", county: "Douglas", description: "Community ministry providing transitional support, housing navigation, and life skills programming for individuals and families rebuilding stability.", is_active: true, is_verified: true, has_funding_available: false },
    contact: { full_name: "Elder Raymond Cole", title: "Director of Community Services", phone: "(770) 555-0524", is_primary: true, accepts_case_conference: true },
    services: [
      { name: "Life Navigation", category: "life_navigation", is_active: true },
      { name: "Housing & Stability", category: "housing_stability", is_active: true },
    ],
  },
];

(async () => {
  let inserted = 0;
  for (const { org, contact, services } of orgs) {
    try {
      const [row] = await rpc("organizations", org);
      const orgId = row.id;

      await rpc("contacts", { ...contact, organization_id: orgId });
      for (const svc of services) {
        await rpc("services", { ...svc, organization_id: orgId });
      }

      console.log(`✓ ${org.name}`);
      inserted++;
    } catch (err) {
      console.error(`✗ ${org.name}: ${err.message}`);
    }
  }
  console.log(`\nDone — ${inserted}/${orgs.length} organizations seeded.`);
})();

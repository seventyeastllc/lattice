// Unified type used by directory components — matches Supabase shape
export type OrgType =
  | "nonprofit"
  | "faith_based"
  | "school"
  | "medical"
  | "housing"
  | "government"
  | "community"
  | "other";

export interface DirectoryContact {
  id: string;
  full_name: string;
  title: string | null;
  phone: string | null;
  accepts_case_conference: boolean;
}

export interface DirectoryService {
  name: string;
  category: string;
}

export interface DirectoryOrg {
  id: string;
  name: string;
  slug: string;
  org_type: OrgType;
  county: string;
  description: string;
  has_funding_available: boolean;
  is_verified: boolean;
  services: DirectoryService[];
  contact: DirectoryContact | null;
  // Phase 2: eligibility & access fields
  website?:                string | null;
  eligibility_summary?:    string | null;
  documentation_required?: string | null;
  intake_process?:         string | null;
  appointment_required?:   boolean | null;
  languages_served?:       string[] | null;
  service_area_counties?:  string[] | null;
  year_established?:       number | null;
  last_verified_at?:       string | null;
}

// Map DB service category keys to display labels
export const SERVICE_CATEGORY_LABELS: Record<string, string> = {
  housing_stability:   "Housing & Shelter",
  health_wellness:     "Health & Wellness",
  food_basic_needs:    "Food & Basic Needs",
  financial_stability: "Financial Stability",
  safety_survivor:     "Safety & Survivor Support",
  employment_reentry:  "Employment & Reentry",
  // legacy keys preserved
  income_benefits:     "Income & Benefits",
  life_navigation:     "Life Navigation",
};

export type OrgType =
  | "nonprofit"
  | "faith_based"
  | "school"
  | "medical"
  | "housing"
  | "government"
  | "other";

export type OrgTier =
  | "participant"
  | "collaborator"
  | "strategic"
  | "anchor";

export type ServiceCategory =
  | "housing_stability"
  | "income_benefits"
  | "health_wellness"
  | "life_navigation";

export type UserRole = "admin" | "staff" | "org_admin" | "member";

export type ConnectionRequestType =
  | "facilitated_connection"
  | "case_conference"
  | "information_only";

export type ConnectionStatus = "pending" | "active" | "resolved" | "closed" | "unresponsive";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  org_type: OrgType | null;
  tier: OrgTier | null;
  membership_tier: OrgTier | null;
  payment_status: "paid" | "unpaid" | "exempt" | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  county: string | null;
  zip: string | null;
  is_active: boolean;
  is_verified: boolean;
  has_funding_available: boolean;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: string;
  organization_id: string | null;
  full_name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
  accepts_case_conference: boolean;
  created_at: string;
}

export interface Service {
  id: string;
  organization_id: string | null;
  category: ServiceCategory | null;
  name: string;
  description: string | null;
  eligibility_notes: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Profile {
  id: string;
  full_name: string | null;
  organization_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRoleRecord {
  id: string;
  user_id: string;
  role: UserRole;
  created_at: string;
}

export interface ConnectionRequest {
  id: string;
  requesting_user_id: string | null;
  target_organization_id: string | null;
  target_contact_id: string | null;
  request_type: ConnectionRequestType | null;
  notes: string | null;
  status: ConnectionStatus;
  created_at: string;
  updated_at: string;
}

// Supabase Database type for typed client
export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: Organization;
        Insert: Omit<Organization, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Organization, "id">>;
      };
      contacts: {
        Row: Contact;
        Insert: Omit<Contact, "id" | "created_at">;
        Update: Partial<Omit<Contact, "id">>;
      };
      services: {
        Row: Service;
        Insert: Omit<Service, "id" | "created_at">;
        Update: Partial<Omit<Service, "id">>;
      };
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, "created_at" | "updated_at">;
        Update: Partial<Omit<Profile, "id">>;
      };
      user_roles: {
        Row: UserRoleRecord;
        Insert: Omit<UserRoleRecord, "id" | "created_at">;
        Update: Partial<Omit<UserRoleRecord, "id">>;
      };
      connection_requests: {
        Row: ConnectionRequest;
        Insert: Omit<ConnectionRequest, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<ConnectionRequest, "id">>;
      };
    };
  };
};

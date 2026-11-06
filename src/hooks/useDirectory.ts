import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { DirectoryOrg, OrgType } from "@/types/directory";
import { sampleOrganizations } from "@/data/sampleOrganizations";

// Shape returned by the Supabase nested select
interface RawOrg {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  org_type: string | null;
  county: string | null;
  has_funding_available: boolean;
  is_verified: boolean;
  website: string | null;
  eligibility_summary: string | null;
  documentation_required: string | null;
  intake_process: string | null;
  appointment_required: boolean | null;
  languages_served: string[] | null;
  service_area_counties: string[] | null;
  year_established: number | null;
  last_verified_at: string | null;
  contacts: {
    id: string;
    full_name: string;
    title: string | null;
    phone: string | null;
    is_primary: boolean;
    accepts_case_conference: boolean;
  }[];
  services: {
    name: string;
    category: string | null;
    is_active: boolean;
  }[];
}

function mapOrg(raw: RawOrg): DirectoryOrg {
  const primaryContact =
    raw.contacts.find((c) => c.is_primary) ?? raw.contacts[0] ?? null;
  return {
    id: raw.id,
    name: raw.name,
    slug: raw.slug,
    org_type: (raw.org_type ?? "other") as OrgType,
    county: raw.county ?? "",
    description: raw.description ?? "",
    has_funding_available: raw.has_funding_available,
    is_verified: raw.is_verified ?? false,
    website: raw.website,
    eligibility_summary: raw.eligibility_summary,
    documentation_required: raw.documentation_required,
    intake_process: raw.intake_process,
    appointment_required: raw.appointment_required,
    languages_served: raw.languages_served,
    service_area_counties: raw.service_area_counties,
    year_established: raw.year_established,
    last_verified_at: raw.last_verified_at,
    services: raw.services
      .filter((s) => s.is_active)
      .map((s) => ({ name: s.name, category: s.category ?? "" })),
    contact: primaryContact
      ? {
          id: primaryContact.id,
          full_name: primaryContact.full_name,
          title: primaryContact.title,
          phone: primaryContact.phone,
          accepts_case_conference: primaryContact.accepts_case_conference,
        }
      : null,
  };
}

// Fallback: map sample data to DirectoryOrg shape so UI never goes empty
function sampleToDirectoryOrg(): DirectoryOrg[] {
  return sampleOrganizations.map((o) => ({
    id: o.id,
    name: o.name,
    slug: o.slug,
    org_type: o.org_type === "community" ? "other" : (o.org_type as OrgType),
    county: o.county,
    description: o.description,
    has_funding_available: o.has_funding,
    is_verified: false,
    services: o.services.map((s) => ({ name: s, category: s.toLowerCase().replace(/[^a-z]/g, "_") })),
    contact: {
      id: "sample",
      full_name: o.contact.name,
      title: o.contact.title,
      phone: o.contact.phone,
      accepts_case_conference: o.accepts_case_conference,
    },
  }));
}

export function useDirectory() {
  return useQuery<DirectoryOrg[]>({
    queryKey: ["directory"],
    networkMode: "always",
    retry: false,
    queryFn: async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const { data, error } = await supabase
          .from("organizations")
          .select(
            `id, name, slug, description, org_type, county, has_funding_available, is_verified,
             website, eligibility_summary, documentation_required, intake_process,
             appointment_required, languages_served, service_area_counties, year_established, last_verified_at,
             contacts(id, full_name, title, phone, is_primary, accepts_case_conference),
             services(name, category, is_active)`
          )
          .eq("is_active", true)
          .eq("is_verified", true)
          .order("name")
          .abortSignal(controller.signal);

        clearTimeout(timeout);

        if (error) return sampleToDirectoryOrg();

        const mapped = ((data ?? []) as unknown as RawOrg[]).map(mapOrg);
        return mapped.length > 0 ? mapped : sampleToDirectoryOrg();
      } catch {
        return sampleToDirectoryOrg();
      }
    },
    staleTime: 1000 * 60 * 5,
  });
}

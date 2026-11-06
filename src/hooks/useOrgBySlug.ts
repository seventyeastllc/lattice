import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { DirectoryOrg, OrgType } from "@/types/directory";

interface RawOrg {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  org_type: string | null;
  county: string | null;
  has_funding_available: boolean;
  is_verified: boolean;
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

export function useOrgBySlug(slug: string | undefined) {
  return useQuery<DirectoryOrg | null>({
    queryKey: ["org", slug],
    networkMode: "always",
    retry: false,
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select(
          `id, name, slug, description, org_type, county, has_funding_available, is_verified,
           contacts(id, full_name, title, phone, is_primary, accepts_case_conference),
           services(name, category, is_active)`
        )
        .eq("slug", slug!)
        .eq("is_active", true)
        .single();

      if (error || !data) return null;
      return mapOrg(data as unknown as RawOrg);
    },
    staleTime: 1000 * 60 * 5,
  });
}

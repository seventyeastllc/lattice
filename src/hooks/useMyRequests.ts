import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

export interface MyRequest {
  id: string;
  status: string;
  created_at: string;
  notes: string | null;
  target_org: { name: string; org_type: string | null } | null;
}

export function useMyRequests() {
  const { user } = useAuth();

  return useQuery<MyRequest[]>({
    queryKey: ["my-requests", user?.id],
    enabled: !!user?.id,
    networkMode: "always",
    retry: false,
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("connection_requests")
        .select(`
          id, status, created_at, notes,
          target_org:organizations!connection_requests_target_organization_id_fkey(name, org_type)
        `)
        .eq("requesting_user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) return [];
      return (data ?? []) as unknown as MyRequest[];
    },
  });
}

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface IncomingRequest {
  id: string;
  request_type: string;
  notes: string | null;
  status: string;
  created_at: string;
  ack_deadline: string | null;
  acknowledged_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  closure_type: string | null;
  is_ack_overdue: boolean;
  assigned_to: string | null;
  is_inactivity_flagged: boolean;
  inactivity_deadline: string | null;
  unable_to_assist_category: string | null;
  parent_request_id: string | null;
  is_collaboration: boolean;
  requester_name: string | null;
  requester_email: string | null;
  requester_org: string | null;
  flagged_at: string | null;
  is_content_restricted: boolean;
}

export function useIncomingRequests(orgId: string | null) {
  return useQuery<IncomingRequest[]>({
    queryKey: ["incoming-requests", orgId],
    enabled: !!orgId,
    networkMode: "always",
    retry: false,
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase.rpc("get_incoming_connection_requests", {
        p_org_id: orgId,
      });
      if (error) return [];
      return (data as unknown as IncomingRequest[]) ?? [];
    },
  });
}

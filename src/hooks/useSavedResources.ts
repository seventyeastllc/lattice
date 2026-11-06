import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export function useSavedResources(userId: string | undefined) {
  return useQuery({
    queryKey: ["saved_resources", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("saved_resources")
        .select("organization_id")
        .eq("user_id", userId);
      if (error) throw error;
      return (data ?? []).map((r: { organization_id: string }) => r.organization_id);
    },
    enabled: !!userId,
    networkMode: "always",
    retry: false,
  });
}

export function useSaveToggle(userId: string | undefined) {
  const queryClient = useQueryClient();

  const save = useMutation({
    mutationFn: async (orgId: string) => {
      const { error } = await supabase
        .from("saved_resources")
        .insert({ user_id: userId, organization_id: orgId });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["saved_resources", userId] }),
  });

  const unsave = useMutation({
    mutationFn: async (orgId: string) => {
      const { error } = await supabase
        .from("saved_resources")
        .delete()
        .eq("user_id", userId)
        .eq("organization_id", orgId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["saved_resources", userId] }),
  });

  return { save, unsave };
}

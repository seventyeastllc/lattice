import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { KnowledgeResource } from "./useKnowledgeResources";

export function useAllKnowledgeResources() {
  return useQuery({
    queryKey: ["knowledge_resources_admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("knowledge_resources")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as KnowledgeResource[];
    },
    networkMode: "always",
    retry: false,
  });
}

export function useKnowledgeResourceMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["knowledge_resources_admin"] });
    qc.invalidateQueries({ queryKey: ["knowledge_resources"] });
  };

  const create = useMutation({
    mutationFn: async (payload: { title: string; description: string; category: string; url: string; is_published: boolean }) => {
      const { error } = await supabase.from("knowledge_resources").insert(payload);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, ...payload }: { id: string; title?: string; description?: string; category?: string; url?: string; is_published?: boolean }) => {
      const { error } = await supabase.from("knowledge_resources").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("knowledge_resources").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { create, update, remove };
}

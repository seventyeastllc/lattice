import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export type KnowledgeResource = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  url: string | null;
  is_published: boolean;
  created_at: string;
};

export function useKnowledgeResources(category?: string) {
  return useQuery({
    queryKey: ["knowledge_resources", category ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("knowledge_resources")
        .select("*")
        .eq("is_published", true)
        .order("created_at");
      if (category && category !== "all") q = q.eq("category", category);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as KnowledgeResource[];
    },
    networkMode: "always",
    retry: false,
  });
}

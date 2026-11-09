import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { KnowledgeResource } from "./useKnowledgeResources";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const FN_URL = `${SUPABASE_URL}/functions/v1/admin-knowledge-write`;

async function adminWrite(action: "insert" | "update" | "delete", body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": ANON_KEY,
      "Authorization": `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ action, ...body }),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Admin write failed");
  return json.data;
}

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
      await adminWrite("insert", { payload });
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, ...payload }: { id: string; title?: string; description?: string; category?: string; url?: string; is_published?: boolean }) => {
      await adminWrite("update", { id, payload });
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await adminWrite("delete", { id });
    },
    onSuccess: invalidate,
  });

  return { create, update, remove };
}

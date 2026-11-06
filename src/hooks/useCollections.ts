import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export type Collection = { id: string; name: string; created_at: string };

export function useCollections(userId: string | undefined) {
  return useQuery({
    queryKey: ["collections", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("resource_collections")
        .select("id, name, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Collection[];
    },
    enabled: !!userId,
    networkMode: "always",
    retry: false,
  });
}

export function useCollectionMutations(userId: string | undefined) {
  const qc = useQueryClient();
  const inv = () => qc.invalidateQueries({ queryKey: ["collections", userId] });

  const create = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase
        .from("resource_collections")
        .insert({ user_id: userId, name });
      if (error) throw error;
    },
    onSuccess: inv,
  });

  const rename = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase
        .from("resource_collections")
        .update({ name, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: inv,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("resource_collections")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: inv,
  });

  return { create, rename, remove };
}

export type CollectionOrg = {
  id: string;
  name: string;
  slug: string | null;
  org_type: string;
  county: string | null;
  description: string | null;
};

export function useCollectionItems(collectionId: string | undefined) {
  return useQuery({
    queryKey: ["collection_items", collectionId],
    queryFn: async () => {
      if (!collectionId) return [];
      const { data, error } = await supabase
        .from("collection_items")
        .select("organization_id, organizations(id, name, slug, org_type, county, description)")
        .eq("collection_id", collectionId);
      if (error) throw error;
      return (data ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((r: any) => r.organizations)
        .filter(Boolean) as CollectionOrg[];
    },
    enabled: !!collectionId,
    networkMode: "always",
    retry: false,
  });
}

export function useCollectionItemMutations() {
  const qc = useQueryClient();

  const addToCollection = useMutation({
    mutationFn: async ({ collectionId, orgId }: { collectionId: string; orgId: string }) => {
      const { error } = await supabase
        .from("collection_items")
        .insert({ collection_id: collectionId, organization_id: orgId });
      if (error) throw error;
    },
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: ["collection_items", vars.collectionId] }),
  });

  const removeFromCollection = useMutation({
    mutationFn: async ({ collectionId, orgId }: { collectionId: string; orgId: string }) => {
      const { error } = await supabase
        .from("collection_items")
        .delete()
        .eq("collection_id", collectionId)
        .eq("organization_id", orgId);
      if (error) throw error;
    },
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: ["collection_items", vars.collectionId] }),
  });

  return { addToCollection, removeFromCollection };
}

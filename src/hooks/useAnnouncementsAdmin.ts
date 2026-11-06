import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Announcement } from "./useAnnouncements";

export function useAllAnnouncements() {
  return useQuery({
    queryKey: ["announcements-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("network_announcements")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Announcement[];
    },
    networkMode: "always",
    retry: false,
  });
}

export function useAnnouncementMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["announcements-admin"] });
    qc.invalidateQueries({ queryKey: ["announcements"] });
  };

  const create = useMutation({
    mutationFn: async (payload: { title: string; body: string; is_published: boolean }) => {
      const { error } = await supabase.from("network_announcements").insert(payload);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, ...payload }: { id: string; title?: string; body?: string; is_published?: boolean }) => {
      const { error } = await supabase.from("network_announcements").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("network_announcements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { create, update, remove };
}

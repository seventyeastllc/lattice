import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export type Announcement = {
  id: string;
  title: string | null;
  body: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

export function useAnnouncements() {
  return useQuery({
    queryKey: ["announcements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("network_announcements")
        .select("*")
        .eq("is_published", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Announcement[];
    },
    networkMode: "always",
    retry: false,
  });
}

import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/auth-provider";

const STALE_TIME = 5 * 60 * 1000; // 5 minutes

interface SupabaseQueryConfig<TList, TRow> {
  table: string;
  queryKeyPrefix: string;
  listSelect: string;
  detailSelect: string;
  listType: TList;
  detailType: TRow;
}

// The types are used via generics, not the config values directly
export function createSupabaseQueries<TList, TRow>(
  config: Omit<SupabaseQueryConfig<TList, TRow>, "listType" | "detailType">,
) {
  const { table, queryKeyPrefix, listSelect, detailSelect } = config;

  function useList() {
    const { user } = useAuth();

    return useQuery({
      queryKey: [queryKeyPrefix, "list", user?.id],
      queryFn: async () => {
        const supabase = createClient();
        const { data, error } = await supabase
          .from(table)
          .select(listSelect)
          .order("generated_at", { ascending: false });
        if (error) throw error;
        return (data as TList[]) ?? [];
      },
      enabled: !!user,
      staleTime: STALE_TIME,
    });
  }

  function useById(id: string) {
    const { user } = useAuth();

    return useQuery({
      queryKey: [queryKeyPrefix, "detail", user?.id, id],
      queryFn: async () => {
        const supabase = createClient();
        const { data, error } = await supabase
          .from(table)
          .select(detailSelect)
          .eq("id", id)
          .single();
        if (error) throw error;
        return data as TRow;
      },
      enabled: !!user && !!id,
    });
  }

  function useExisting(userId: string | undefined, username: string) {
    return useQuery({
      queryKey: [queryKeyPrefix, "exists", userId, username],
      queryFn: async () => {
        const supabase = createClient();
        const { data } = await supabase
          .from(table)
          .select("id")
          .eq("user_id", userId!)
          .eq("analyzed_username", username)
          .limit(1);
        return data && data.length > 0;
      },
      enabled: !!userId,
    });
  }

  function useDelete() {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: async (ids: string[]) => {
        const supabase = createClient();
        const { error } = await supabase.from(table).delete().in("id", ids);
        if (error) throw error;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [queryKeyPrefix] });
      },
    });
  }

  return { useList, useById, useExisting, useDelete };
}

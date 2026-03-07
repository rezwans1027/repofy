import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/auth-provider";
import { STALE_LONG } from "@/lib/query-client";

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
          .eq("user_id", user!.id)
          .order("generated_at", { ascending: false });
        if (error) throw error;
        return (data as TList[]) ?? [];
      },
      enabled: !!user,
      staleTime: STALE_LONG,
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
          .eq("user_id", user!.id)
          .single();
        if (error) throw error;
        return data as TRow;
      },
      enabled: !!user && !!id,
    });
  }

  function useExisting(username: string) {
    const { user } = useAuth();

    return useQuery({
      queryKey: [queryKeyPrefix, "exists", user?.id, username.toLowerCase()],
      queryFn: async () => {
        const supabase = createClient();
        const { data, error } = await supabase
          .from(table)
          .select("id")
          .eq("user_id", user!.id)
          .eq("analyzed_username", username.toLowerCase())
          .limit(1);
        if (error) throw error;
        return data && data.length > 0;
      },
      enabled: !!user,
    });
  }

  function useDelete() {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: async (ids: string[]) => {
        if (!user) throw new Error("Not authenticated");
        const supabase = createClient();
        const { error } = await supabase
          .from(table)
          .delete()
          .in("id", ids)
          .eq("user_id", user.id);
        if (error) throw error;
      },
      onMutate: async (ids) => {
        await queryClient.cancelQueries({ queryKey: [queryKeyPrefix, "list", user?.id] });
        const previous = queryClient.getQueryData<(TList & { id: string })[]>([queryKeyPrefix, "list", user?.id]);
        if (previous) {
          const idSet = new Set(ids);
          queryClient.setQueryData(
            [queryKeyPrefix, "list", user?.id],
            previous.filter((item) => !idSet.has(item.id)),
          );
        }
        return { previous };
      },
      onError: (_err, _ids, context) => {
        if (context?.previous) {
          queryClient.setQueryData([queryKeyPrefix, "list", user?.id], context.previous);
        }
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: [queryKeyPrefix] });
      },
    });
  }

  return { useList, useById, useExisting, useDelete };
}

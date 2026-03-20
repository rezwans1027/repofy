import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { api } from "@/lib/api-client";
import { useAuth } from "@/components/providers/auth-provider";
import { STALE_LONG } from "@/lib/query-client";

interface CrudHooksConfig<TListItem> {
  queryKey: string;
  endpoint: string;
  listSchema: z.ZodType<TListItem[]>;
  detailSchema: z.ZodType;
}

export function createCrudHooks<TListItem extends { id: string }>(config: CrudHooksConfig<TListItem>) {
  const { queryKey, endpoint, listSchema, detailSchema } = config;

  function useList() {
    const { user } = useAuth();
    return useQuery({
      queryKey: [queryKey, "list"],
      queryFn: () => api.get<TListItem[]>(endpoint, { schema: listSchema }),
      enabled: !!user,
      staleTime: STALE_LONG,
    });
  }

  function useDetail(id: string) {
    const { user } = useAuth();
    return useQuery({
      queryKey: [queryKey, "detail", id],
      queryFn: () => api.get(`${endpoint}/${id}`, { schema: detailSchema }),
      enabled: !!user && !!id,
    });
  }

  function useExists(username: string) {
    const { user } = useAuth();
    return useQuery({
      queryKey: [queryKey, "exists", username.toLowerCase()],
      queryFn: () => api.get<boolean>(`${endpoint}/exists/${encodeURIComponent(username)}`, { schema: z.boolean() }),
      enabled: !!user,
    });
  }

  function useDelete() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (ids: string[]) => { await api.delete(endpoint, { body: { ids } }); },
      onMutate: async (ids) => {
        await queryClient.cancelQueries({ queryKey: [queryKey, "list"] });
        const previous = queryClient.getQueryData<TListItem[]>([queryKey, "list"]);
        if (previous) {
          const idSet = new Set(ids);
          queryClient.setQueryData(
            [queryKey, "list"],
            previous.filter((item) => !idSet.has(item.id)),
          );
        }
        return { previous };
      },
      onError: (_err, _ids, context) => {
        if (context?.previous) {
          queryClient.setQueryData([queryKey, "list"], context.previous);
        }
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: [queryKey] });
      },
    });
  }

  return { useList, useDetail, useExists, useDelete };
}

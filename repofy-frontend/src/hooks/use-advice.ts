import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useAuth } from "@/components/providers/auth-provider";
import { STALE_LONG } from "@/lib/query-client";
import type { AdviceData } from "@/types/advice";

export interface AdviceListItem {
  id: string;
  analyzed_username: string;
  generated_at: string;
  analyzed_name: string | null;
}

interface AdviceRow {
  id: string;
  analyzed_username: string;
  user_id: string;
  advice_data: AdviceData;
}

export function useAdviceList() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["advice", "list"],
    queryFn: () => api.get<AdviceListItem[]>("/advice", { auth: true }),
    enabled: !!user,
    staleTime: STALE_LONG,
  });
}

export function useAdvice(id: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["advice", "detail", id],
    queryFn: () => api.get<AdviceRow>(`/advice/${id}`, { auth: true }),
    enabled: !!user && !!id,
  });
}

export function useExistingAdvice(username: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["advice", "exists", username.toLowerCase()],
    queryFn: () => api.get<boolean>(`/advice/exists/${encodeURIComponent(username)}`, { auth: true }),
    enabled: !!user,
  });
}

export function useDeleteAdvice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => { await api.delete("/advice", { auth: true, body: { ids } }); },
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: ["advice", "list"] });
      const previous = queryClient.getQueryData<AdviceListItem[]>(["advice", "list"]);
      if (previous) {
        const idSet = new Set(ids);
        queryClient.setQueryData(
          ["advice", "list"],
          previous.filter((item) => !idSet.has(item.id)),
        );
      }
      return { previous };
    },
    onError: (_err, _ids, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["advice", "list"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["advice"] });
    },
  });
}

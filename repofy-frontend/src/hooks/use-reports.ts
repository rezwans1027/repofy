import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useAuth } from "@/components/providers/auth-provider";
import { STALE_LONG } from "@/lib/query-client";
import type { ReportData } from "@/types/report";

export interface ReportListItem {
  id: string;
  analyzed_username: string;
  overall_score: number;
  recommendation: string;
  generated_at: string;
  analyzed_name: string | null;
}

interface ReportRow {
  id: string;
  analyzed_username: string;
  report_data: ReportData;
}

export function useReports() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["reports", "list"],
    queryFn: () => api.get<ReportListItem[]>("/reports", { auth: true }),
    enabled: !!user,
    staleTime: STALE_LONG,
  });
}

export function useReport(id: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["reports", "detail", id],
    queryFn: () => api.get<ReportRow>(`/reports/${id}`, { auth: true }),
    enabled: !!user && !!id,
  });
}

export function useExistingReport(username: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["reports", "exists", username.toLowerCase()],
    queryFn: () => api.get<boolean>(`/reports/exists/${encodeURIComponent(username)}`, { auth: true }),
    enabled: !!user,
  });
}

export function useDeleteReports() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => { await api.delete("/reports", { auth: true, body: { ids } }); },
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: ["reports", "list"] });
      const previous = queryClient.getQueryData<ReportListItem[]>(["reports", "list"]);
      if (previous) {
        const idSet = new Set(ids);
        queryClient.setQueryData(
          ["reports", "list"],
          previous.filter((item) => !idSet.has(item.id)),
        );
      }
      return { previous };
    },
    onError: (_err, _ids, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["reports", "list"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
  });
}

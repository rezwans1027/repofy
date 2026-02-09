import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/auth-provider";
import type { ReportData } from "@/components/report/analysis-report";

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
    queryKey: ["reports", "list", user?.id],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("reports")
        .select(
          "id, analyzed_username, analyzed_name, overall_score, recommendation, generated_at",
        )
        .order("generated_at", { ascending: false });
      if (error) throw error;
      return (data as ReportListItem[]) ?? [];
    },
    enabled: !!user,
    staleTime: 0,
  });
}

export function useReport(id: string) {
  return useQuery({
    queryKey: ["reports", "detail", id],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("reports")
        .select("id, analyzed_username, report_data")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as ReportRow;
    },
    enabled: !!id,
  });
}

export function useExistingReport(
  userId: string | undefined,
  username: string,
) {
  return useQuery({
    queryKey: ["reports", "exists", userId, username],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("reports")
        .select("id")
        .eq("user_id", userId!)
        .eq("analyzed_username", username)
        .limit(1);
      return data && data.length > 0;
    },
    enabled: !!userId,
  });
}

export function useDeleteReports() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("reports")
        .delete()
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
  });
}

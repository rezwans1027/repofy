import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { createClient } from "@/lib/supabase/client";

interface GenerateReportResult {
  analyzedName: string | null;
  report: Record<string, unknown>;
}

interface GenerateAdviceResult {
  analyzedName: string | null;
  advice: Record<string, unknown>;
}

export function useGenerateReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      username,
      userId,
    }: {
      username: string;
      userId: string;
    }) => {
      const data = await api.post<GenerateReportResult>(
        `/analyze/${encodeURIComponent(username)}`,
        { auth: true },
      );

      const supabase = createClient();
      const { data: row, error: insertError } = await supabase
        .from("reports")
        .insert({
          user_id: userId,
          analyzed_username: username,
          analyzed_name: data.analyzedName,
          overall_score: (data.report as { overallScore: number }).overallScore,
          recommendation: (data.report as { recommendation: string })
            .recommendation,
          report_data: data.report,
        })
        .select("id")
        .single();

      if (insertError) throw insertError;

      // Remove previous reports for the same user/username, keeping the new one
      await supabase
        .from("reports")
        .delete()
        .eq("user_id", userId)
        .eq("analyzed_username", username)
        .neq("id", row.id);

      return { id: row.id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
  });
}

export function useGenerateAdvice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      username,
      userId,
    }: {
      username: string;
      userId: string;
    }) => {
      const data = await api.post<GenerateAdviceResult>(
        `/advice/${encodeURIComponent(username)}`,
        { auth: true },
      );

      const supabase = createClient();
      const { data: row, error: insertError } = await supabase
        .from("advice")
        .insert({
          user_id: userId,
          analyzed_username: username,
          analyzed_name: data.analyzedName,
          advice_data: data.advice,
        })
        .select("id")
        .single();

      if (insertError) throw insertError;

      // Remove previous advice for the same user/username, keeping the new one
      await supabase
        .from("advice")
        .delete()
        .eq("user_id", userId)
        .eq("analyzed_username", username)
        .neq("id", row.id);

      return { id: row.id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["advice"] });
    },
  });
}

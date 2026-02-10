"use client";

import { use, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AnalysisLoading } from "@/components/report/analysis-loading";
import { useAuth } from "@/components/providers/auth-provider";
import { api } from "@/lib/api-client";
import { createClient } from "@/lib/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { BackLink } from "@/components/ui/back-link";
import { ErrorCard } from "@/components/ui/error-card";

export default function GeneratePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    const data = await api.post<{
      analyzedName: string | null;
      report: Record<string, unknown>;
    }>(`/analyze/${encodeURIComponent(username)}`, { auth: true });
    return data;
  }, [username]);

  const handleComplete = useCallback(
    async (data: unknown) => {
      if (!user) {
        setError("You must be logged in to generate a report.");
        return;
      }

      try {
        const { analyzedName, report } = data as {
          analyzedName: string | null;
          report: Record<string, unknown>;
        };

        const supabase = createClient();

        const { data: row, error: insertError } = await supabase
          .from("reports")
          .insert({
            user_id: user.id,
            analyzed_username: username,
            analyzed_name: analyzedName,
            overall_score: (report as { overallScore: number }).overallScore,
            recommendation: (report as { recommendation: string })
              .recommendation,
            report_data: report,
          })
          .select("id")
          .single();

        if (insertError) throw insertError;

        // Best-effort cleanup: retry once to handle transient failures
        for (let attempt = 0; attempt < 2; attempt++) {
          const { error: cleanupError } = await supabase
            .from("reports")
            .delete()
            .eq("user_id", user.id)
            .eq("analyzed_username", username)
            .neq("id", row.id);
          if (!cleanupError) break;
          if (attempt === 1)
            console.error("Cleanup of old reports failed after retry:", cleanupError);
        }

        queryClient.invalidateQueries({ queryKey: ["reports"] });
        router.replace(`/report/${row.id}?from=profile`);
      } catch (err) {
        console.error("Failed to save report:", err);
        setError("Failed to save report. Please try again.");
      }
    },
    [user, username, router, queryClient],
  );

  const handleError = useCallback((message: string) => {
    setError(message);
  }, []);

  if (error) {
    return (
      <div>
        <BackLink href={`/profile/${username}`} label="back to profile" />
        <ErrorCard message={error}>
          <button
            onClick={() => {
              setError(null);
              router.refresh();
            }}
            className="mt-4 font-mono text-xs text-cyan hover:underline"
          >
            Try again
          </button>
        </ErrorCard>
      </div>
    );
  }

  return (
    <div>
      <BackLink href={`/profile/${username}`} label="back to profile" />
      <AnalysisLoading
        fetchReport={fetchReport}
        onComplete={handleComplete}
        onError={handleError}
      />
    </div>
  );
}

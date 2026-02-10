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

        // Atomic upsert — inserts or replaces the existing report in one
        // DB operation.  Requires the UNIQUE (user_id, analyzed_username)
        // constraint from migration 003.
        const { data: row, error: upsertError } = await supabase
          .from("reports")
          .upsert(
            {
              user_id: user.id,
              analyzed_username: username,
              analyzed_name: analyzedName,
              overall_score: (report as { overallScore: number }).overallScore,
              recommendation: (report as { recommendation: string })
                .recommendation,
              report_data: report,
              generated_at: new Date().toISOString(),
            },
            { onConflict: "user_id,analyzed_username" },
          )
          .select("id")
          .single();

        if (upsertError) throw upsertError;

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

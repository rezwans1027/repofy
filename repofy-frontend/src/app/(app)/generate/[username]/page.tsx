"use client";

import { use, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AnalysisLoading } from "@/components/report/analysis-loading";
import { useAuth } from "@/components/providers/auth-provider";
import { api } from "@/lib/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { BackLink } from "@/components/ui/back-link";
import { ErrorCard } from "@/components/ui/error-card";

const ANALYSIS_TIMEOUT_MS = 120_000;

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
      reportId: string;
    }>(`/analyze/${encodeURIComponent(username)}`, {
      auth: true,
      signal: AbortSignal.timeout(ANALYSIS_TIMEOUT_MS),
    });
    return data;
  }, [username]);

  const handleComplete = useCallback(
    async (data: unknown) => {
      if (!user) {
        setError("You must be logged in to generate a report.");
        return;
      }

      const result =
        typeof data === "object" && data !== null && "reportId" in data
          ? (data as { reportId: string })
          : null;
      if (!result) {
        setError("Unexpected response from server.");
        return;
      }
      const { reportId } = result;

      queryClient.invalidateQueries({ queryKey: ["reports"] });
      router.replace(`/report/${reportId}?from=profile`);
    },
    [user, router, queryClient],
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

"use client";

import { use, useState, useCallback, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AnalysisLoading } from "@/components/report/analysis-loading";
import { api, ApiError } from "@/lib/api-client";
import { useCreditBalance } from "@/hooks/use-credits";
import { useAdviceJob } from "@/hooks/use-advice-job";
import { useQueryClient } from "@tanstack/react-query";
import { BackLink } from "@/components/ui/back-link";
import { ErrorCard } from "@/components/ui/error-card";
import { Coins } from "lucide-react";

const NO_CREDITS_SENTINEL = "__NO_CREDITS__";

const ADVICE_PHASES = [
  "Scanning profile...",
  "Mapping skill landscape...",
  "Analyzing market demand...",
  "Evaluating project complexity...",
  "Planning 12-week progression...",
  "Writing learning objectives...",
  "Validating roadmap coherence...",
  "Generating growth plan...",
];

/** Never-resolving promise — used in resume mode where fetchReport is a no-op. */
const neverResolves = () => new Promise<unknown>(() => {});

export default function GenerateAdvicePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { data: balance, isLoading: balanceLoading } = useCreditBalance();
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(searchParams.get("jobId"));
  const [jobCreatedAt, setJobCreatedAt] = useState<string | null>(null);
  const redirectedRef = useRef(false);

  const isResumeMode = !!searchParams.get("jobId");
  const hasNoCredits = !balanceLoading && balance && balance.growth_balance <= 0;

  const backHref = isResumeMode ? "/advisor" : `/profile/${username}`;
  const backLabel = isResumeMode ? "back to advisor" : "back to profile";

  // Poll the job status
  const { data: jobData } = useAdviceJob(jobId);

  // Handle job completion — redirect to the advice page
  const jobCompleted = jobData?.status === "completed" && !!jobData.advice_id;
  const jobFailed = jobData?.status === "failed";

  // In resume mode, compute initialElapsed from job creation time.
  // useMemo ensures Date.now() is captured once per dependency change (not every render).
  const initialElapsed = useMemo(() => {
    if (isResumeMode && jobData?.created_at) {
      return (Date.now() - new Date(jobData.created_at).getTime()) / 1000;
    }
    if (jobCreatedAt) {
      return (Date.now() - new Date(jobCreatedAt).getTime()) / 1000;
    }
    return 0;
  }, [isResumeMode, jobData?.created_at, jobCreatedAt]);

  // Start mode: POST to create the job, then return a never-resolving promise
  // (completion is signaled via the `completed` prop from polling)
  const fetchAdvice = useCallback(async () => {
    try {
      const data = await api.post<{ jobId: string; createdAt: string }>(
        `/advice/${encodeURIComponent(username)}`,
        { signal: AbortSignal.timeout(300_000) },
      );
      setJobId(data.jobId);
      setJobCreatedAt(data.createdAt);
      // Invalidate active job cache so /advisor page picks up the new job immediately
      queryClient.invalidateQueries({ queryKey: ["advice", "jobs", "active"] });
      // Return a never-resolving promise — completion is driven by polling
      return new Promise<unknown>(() => {});
    } catch (err) {
      if (err instanceof ApiError && err.status === 402) {
        throw new Error(NO_CREDITS_SENTINEL);
      }
      throw err;
    }
  }, [username, queryClient]);

  const handleComplete = useCallback(
    (data: unknown) => {
      if (redirectedRef.current) return;
      // If called by external completion (data is null), use jobData for adviceId
      const adviceId = jobData?.advice_id
        ?? (typeof data === "object" && data !== null && "adviceId" in data
          ? (data as { adviceId: string }).adviceId
          : null);
      if (!adviceId) {
        setError("Unexpected response from server.");
        return;
      }
      redirectedRef.current = true;
      queryClient.invalidateQueries({ queryKey: ["advice"] });
      queryClient.invalidateQueries({ queryKey: ["credits", "balance"] });
      router.replace(`/advisor/${adviceId}?from=profile`);
    },
    [router, queryClient, jobData?.advice_id],
  );

  const handleError = useCallback((message: string) => {
    setError(message);
  }, []);

  // Resume mode: if already completed, redirect immediately
  if (isResumeMode && jobCompleted && !redirectedRef.current) {
    redirectedRef.current = true;
    queryClient.invalidateQueries({ queryKey: ["advice"] });
    queryClient.invalidateQueries({ queryKey: ["credits", "balance"] });
    router.replace(`/advisor/${jobData.advice_id}?from=profile`);
    return null;
  }

  // Resume mode: if job failed, show error
  if (isResumeMode && jobFailed) {
    return (
      <div>
        <BackLink href={backHref} label={backLabel} hoverColor="hover:text-emerald-400" />
        <ErrorCard message={jobData?.error ?? "Advice generation failed."}>
          <button
            onClick={() => {
              setError(null);
              router.push(`/advisor/generate/${username}`);
            }}
            className="mt-4 font-mono text-xs text-emerald-400 hover:underline"
          >
            Try again
          </button>
        </ErrorCard>
      </div>
    );
  }

  if (!isResumeMode && (hasNoCredits || (error && error === NO_CREDITS_SENTINEL))) {
    return (
      <div>
        <BackLink href={backHref} label={backLabel} hoverColor="hover:text-emerald-400" />
        <ErrorCard message="You don't have any growth credits. Purchase credits to get personalized advice.">
          <div className="mt-4 flex items-center gap-3">
            <Coins className="size-4 text-cyan" />
            <Link
              href="/pricing"
              className="font-mono text-xs text-cyan hover:underline"
            >
              Buy Credits
            </Link>
          </div>
        </ErrorCard>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <BackLink href={backHref} label={backLabel} hoverColor="hover:text-emerald-400" />
        <ErrorCard message={error}>
          <button
            onClick={() => {
              setError(null);
              router.refresh();
            }}
            className="mt-4 font-mono text-xs text-emerald-400 hover:underline"
          >
            Try again
          </button>
        </ErrorCard>
      </div>
    );
  }

  return (
    <div>
      <title>{`Generating advice for @${username} — Repofy`}</title>
      <BackLink href={backHref} label={backLabel} hoverColor="hover:text-emerald-400" />
      <AnalysisLoading
        fetchReport={isResumeMode ? neverResolves : fetchAdvice}
        onComplete={handleComplete}
        onError={handleError}
        phases={ADVICE_PHASES}
        accentColor="text-emerald-400"
        title="repofy — advisor engine"
        initialElapsed={isResumeMode ? initialElapsed : 0}
        completed={jobCompleted}
      />
    </div>
  );
}

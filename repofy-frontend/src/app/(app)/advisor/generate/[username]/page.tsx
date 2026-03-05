"use client";

import { use, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnalysisLoading } from "@/components/report/analysis-loading";
import { useAuth } from "@/components/providers/auth-provider";
import { api, ApiError } from "@/lib/api-client";
import { useCreditBalance } from "@/hooks/use-credits";
import { useQueryClient } from "@tanstack/react-query";
import { BackLink } from "@/components/ui/back-link";
import { ErrorCard } from "@/components/ui/error-card";
import { Coins } from "lucide-react";

const NO_CREDITS_SENTINEL = "__NO_CREDITS__";

const ADVICE_PHASES = [
  "Scanning profile...",
  "Inferring career trajectory...",
  "Sequencing builds across 12 weeks...",
  "Generating weekly roadmap...",
];

export default function GenerateAdvicePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: balance, isLoading: balanceLoading } = useCreditBalance();
  const [error, setError] = useState<string | null>(null);

  const hasNoCredits = !balanceLoading && balance && balance.growth_balance <= 0;

  const fetchAdvice = useCallback(async () => {
    try {
      const data = await api.post<{ adviceId: string }>(
        `/advice/${encodeURIComponent(username)}`,
        { auth: true, signal: AbortSignal.timeout(300_000) },
      );
      return data;
    } catch (err) {
      if (err instanceof ApiError && err.status === 402) {
        throw new Error(NO_CREDITS_SENTINEL);
      }
      throw err;
    }
  }, [username]);

  const handleComplete = useCallback(
    (data: unknown) => {
      const { adviceId } = data as { adviceId: string };
      queryClient.invalidateQueries({ queryKey: ["advice"] });
      queryClient.invalidateQueries({ queryKey: ["credits", "balance"] });
      router.replace(`/advisor/${adviceId}?from=profile`);
    },
    [router, queryClient],
  );

  const handleError = useCallback((message: string) => {
    setError(message);
  }, []);

  if (hasNoCredits || (error && error === NO_CREDITS_SENTINEL)) {
    return (
      <div>
        <BackLink href={`/profile/${username}`} label="back to profile" hoverColor="hover:text-emerald-400" />
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
        <BackLink href={`/profile/${username}`} label="back to profile" hoverColor="hover:text-emerald-400" />
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
      <BackLink href={`/profile/${username}`} label="back to profile" hoverColor="hover:text-emerald-400" />
      <AnalysisLoading
        fetchReport={fetchAdvice}
        onComplete={handleComplete}
        onError={handleError}
        phases={ADVICE_PHASES}
        accentColor="text-emerald-400"
        title="repofy — advisor engine"
      />
    </div>
  );
}

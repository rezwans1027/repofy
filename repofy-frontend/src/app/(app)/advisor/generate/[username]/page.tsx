"use client";

import { use, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnalysisLoading } from "@/components/report/analysis-loading";
import { useAuth } from "@/components/providers/auth-provider";
import { api, ApiError } from "@/lib/api-client";
import { createClient } from "@/lib/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { BackLink } from "@/components/ui/back-link";
import { ErrorCard } from "@/components/ui/error-card";
import { Coins } from "lucide-react";

const NO_CREDITS_SENTINEL = "__NO_CREDITS__";

const ADVICE_PHASES = [
  "Scanning profile...",
  "Analyzing skill gaps...",
  "Researching market trends...",
  "Building your action plan...",
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
  const [error, setError] = useState<string | null>(null);

  const fetchAdvice = useCallback(async () => {
    try {
      const data = await api.post<{
        analyzedName: string | null;
        advice: Record<string, unknown>;
      }>(`/advice/${encodeURIComponent(username)}`, { auth: true });
      return data;
    } catch (err) {
      if (err instanceof ApiError && err.status === 402) {
        throw new Error(NO_CREDITS_SENTINEL);
      }
      throw err;
    }
  }, [username]);

  const handleComplete = useCallback(
    async (data: unknown) => {
      if (!user) {
        setError("You must be logged in to generate advice.");
        return;
      }

      try {
        const { analyzedName, advice } = data as {
          analyzedName: string | null;
          advice: Record<string, unknown>;
        };

        const supabase = createClient();

        const adviceRow = {
          user_id: user.id,
          analyzed_username: username.toLowerCase(),
          analyzed_name: analyzedName,
          advice_data: advice,
        };

        // Try atomic upsert (works after migration 003 adds unique constraint)
        const { data: upserted, error: upsertError } = await supabase
          .from("advice")
          .upsert(adviceRow, { onConflict: "user_id,analyzed_username" })
          .select("id")
          .single();

        let row: { id: string };

        if (upsertError) {
          // 42P10 = constraint not found — migration not yet applied
          if (upsertError.code !== "42P10") throw upsertError;

          // Fallback: insert + best-effort cleanup of old rows
          const { data: inserted, error: insertError } = await supabase
            .from("advice")
            .insert(adviceRow)
            .select("id")
            .single();
          if (insertError) throw insertError;
          row = inserted;

          const { error: cleanupError } = await supabase
            .from("advice")
            .delete()
            .eq("user_id", user.id)
            .eq("analyzed_username", username.toLowerCase())
            .neq("id", row.id);
          if (cleanupError)
            console.error("Cleanup of old advice failed:", cleanupError);
        } else {
          row = upserted;
        }

        queryClient.invalidateQueries({ queryKey: ["advice"] });
        queryClient.invalidateQueries({ queryKey: ["credits", "balance"] });
        router.replace(`/advisor/${row.id}?from=profile`);
      } catch (err) {
        console.error("Failed to save advice:", err);
        setError("Failed to save advice. Please try again.");
      }
    },
    [user, username, router, queryClient],
  );

  const handleError = useCallback((message: string) => {
    setError(message);
  }, []);

  if (error) {
    const isNoCredits = error === NO_CREDITS_SENTINEL;

    return (
      <div>
        <BackLink href={`/profile/${username}`} label="back to profile" hoverColor="hover:text-emerald-400" />
        {isNoCredits ? (
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
        ) : (
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
        )}
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

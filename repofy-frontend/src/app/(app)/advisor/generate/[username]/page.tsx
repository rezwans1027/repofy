"use client";

import { use, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AnalysisLoading } from "@/components/report/analysis-loading";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/lib/supabase/client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

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
  const [error, setError] = useState<string | null>(null);

  const fetchAdvice = useCallback(async () => {
    const res = await fetch(
      `${API_URL}/advice/${encodeURIComponent(username)}`,
      { method: "POST" },
    );
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error || "Advice generation failed");
    }
    return json.data;
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

        // Delete any existing advice for this user/username combo
        await supabase
          .from("advice")
          .delete()
          .eq("user_id", user.id)
          .eq("analyzed_username", username);

        const { data: row, error: insertError } = await supabase
          .from("advice")
          .insert({
            user_id: user.id,
            analyzed_username: username,
            analyzed_name: analyzedName,
            advice_data: advice,
          })
          .select("id")
          .single();

        if (insertError) throw insertError;

        router.replace(`/advisor/${row.id}`);
      } catch (err) {
        console.error("Failed to save advice:", err);
        setError("Failed to save advice. Please try again.");
      }
    },
    [user, username, router],
  );

  const handleError = useCallback((message: string) => {
    setError(message);
  }, []);

  if (error) {
    return (
      <div>
        <div className="mb-4">
          <Link
            href={`/profile/${username}`}
            className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-emerald-400 transition-colors"
          >
            <ArrowLeft className="size-3" />
            back to profile
          </Link>
        </div>
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-6 text-center max-w-md">
            <p className="font-mono text-sm text-red-400">{error}</p>
            <button
              onClick={() => {
                setError(null);
                router.refresh();
              }}
              className="mt-4 font-mono text-xs text-emerald-400 hover:underline"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <Link
          href={`/profile/${username}`}
          className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-emerald-400 transition-colors"
        >
          <ArrowLeft className="size-3" />
          back to profile
        </Link>
      </div>
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

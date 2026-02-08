"use client";

import { use, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AnalysisLoading } from "@/components/report/analysis-loading";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/lib/supabase/client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

export default function GeneratePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.refreshSession();
    const accessToken = session?.access_token;

    const res = await fetch(
      `${API_URL}/analyze/${encodeURIComponent(username)}`,
      {
        method: "POST",
        headers: {
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
      },
    );
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error || "Analysis failed");
    }
    return json.data;
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

        // Insert first, then clean up old rows so data is never lost
        const { data: row, error: insertError } = await supabase
          .from("reports")
          .insert({
            user_id: user.id,
            analyzed_username: username,
            analyzed_name: analyzedName,
            overall_score: (report as { overallScore: number }).overallScore,
            recommendation: (report as { recommendation: string }).recommendation,
            report_data: report,
          })
          .select("id")
          .single();

        if (insertError) throw insertError;

        // Remove previous reports for the same user/username, keeping the new one
        await supabase
          .from("reports")
          .delete()
          .eq("user_id", user.id)
          .eq("analyzed_username", username)
          .neq("id", row.id);

        router.replace(`/report/${row.id}?from=profile`);
      } catch (err) {
        console.error("Failed to save report:", err);
        setError("Failed to save report. Please try again.");
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
            className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-cyan transition-colors"
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
              className="mt-4 font-mono text-xs text-cyan hover:underline"
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
          className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-cyan transition-colors"
        >
          <ArrowLeft className="size-3" />
          back to profile
        </Link>
      </div>
      <AnalysisLoading
        fetchReport={fetchReport}
        onComplete={handleComplete}
        onError={handleError}
      />
    </div>
  );
}

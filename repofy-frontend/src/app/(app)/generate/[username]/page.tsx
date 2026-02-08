"use client";

import { use, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AnalysisLoading } from "@/components/report/analysis-loading";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/lib/supabase/client";
import { reportData } from "@/lib/demo-data";

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

  const handleLoadingComplete = useCallback(async () => {
    if (!user) {
      setError("You must be logged in to generate a report.");
      return;
    }

    try {
      let analyzedName: string | null = null;
      try {
        const res = await fetch(`${API_URL}/github/${encodeURIComponent(username)}`);
        const json = await res.json();
        if (json.success && json.data?.profile?.name) {
          analyzedName = json.data.profile.name;
        }
      } catch {}

      const supabase = createClient();

      // Delete any existing reports for this user before inserting
      await supabase
        .from("reports")
        .delete()
        .eq("user_id", user.id)
        .eq("analyzed_username", username);

      const { data, error: insertError } = await supabase
        .from("reports")
        .insert({
          user_id: user.id,
          analyzed_username: username,
          analyzed_name: analyzedName,
          overall_score: reportData.overallScore,
          recommendation: reportData.recommendation,
          report_data: reportData,
        })
        .select("id")
        .single();

      if (insertError) throw insertError;

      router.replace(`/report/${data.id}`);
    } catch (err) {
      console.error("Failed to save report:", err);
      setError("Failed to save report. Please try again.");
    }
  }, [user, username, router]);

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
      <AnalysisLoading onComplete={handleLoadingComplete} />
    </div>
  );
}

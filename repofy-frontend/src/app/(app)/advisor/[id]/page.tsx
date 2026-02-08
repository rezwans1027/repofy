"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AdviceReport } from "@/components/advice/advice-report";
import type { AdviceData } from "@/components/advice/advice-report";
import { createClient } from "@/lib/supabase/client";

interface AdviceRow {
  id: string;
  analyzed_username: string;
  user_id: string;
  advice_data: AdviceData;
}

export default function AdvicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const fromProfile = searchParams.get("from") === "profile";
  const [advice, setAdvice] = useState<AdviceRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("advice")
      .select("id, analyzed_username, user_id, advice_data")
      .eq("id", id)
      .single()
      .then(({ data, error: fetchError }) => {
        if (fetchError || !data) {
          setError(true);
        } else {
          setAdvice(data as AdviceRow);
        }
        setLoading(false);
      });
  }, [id]);

  const backHref = fromProfile && advice
    ? `/profile/${advice.analyzed_username}`
    : "/advisor";
  const backLabel = fromProfile && advice ? "back to profile" : "back to advisor";

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-6 w-32 animate-pulse rounded bg-secondary" />
        <div className="h-32 animate-pulse rounded-lg bg-secondary" />
        <div className="h-48 animate-pulse rounded-lg bg-secondary" />
        <div className="h-48 animate-pulse rounded-lg bg-secondary" />
      </div>
    );
  }

  if (error || !advice) {
    return (
      <div>
        <div className="mb-4">
          <Link
            href="/advisor"
            className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-emerald-400 transition-colors"
          >
            <ArrowLeft className="size-3" />
            back to advisor
          </Link>
        </div>
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="rounded-lg border border-border bg-card p-6 text-center max-w-md">
            <p className="font-mono text-sm text-muted-foreground">
              Advice not found
            </p>
            <p className="mt-2 text-xs text-muted-foreground/70">
              This advice may have been deleted or you don&apos;t have access to it.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-emerald-400 transition-colors"
        >
          <ArrowLeft className="size-3" />
          {backLabel}
        </Link>
      </div>
      <AdviceReport
        username={advice.analyzed_username}
        data={advice.advice_data}
      />
    </div>
  );
}

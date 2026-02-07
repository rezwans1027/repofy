"use client";

import { use, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AnalysisLoading } from "@/components/report/analysis-loading";
import { AnalysisReport } from "@/components/report/analysis-report";

export default function ReportPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = use(params);
  const [isLoading, setIsLoading] = useState(true);

  const handleLoadingComplete = useCallback(() => {
    setIsLoading(false);
  }, []);

  return (
    <div>
      {/* Back link — always visible */}
      <div className="mb-4">
        <Link
          href={`/profile/${username}`}
          className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-cyan transition-colors"
        >
          <ArrowLeft className="size-3" />
          back to profile
        </Link>
      </div>

      {isLoading ? (
        <AnalysisLoading onComplete={handleLoadingComplete} />
      ) : (
        <AnalysisReport username={username} />
      )}
    </div>
  );
}

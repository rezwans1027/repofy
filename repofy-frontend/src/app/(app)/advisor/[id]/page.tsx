"use client";

import { use } from "react";
import { useSearchParams } from "next/navigation";
import { AdviceReport } from "@/components/advice/advice-report";
import { useAuth } from "@/components/providers/auth-provider";
import { useAdvice } from "@/hooks/use-advice";
import { BackLink } from "@/components/ui/back-link";
import { ErrorCard } from "@/components/ui/error-card";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdvicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const fromProfile = searchParams.get("from") === "profile";
  const { isLoading: authLoading } = useAuth();
  const { data: advice, isPending: queryPending, error } = useAdvice(id);
  const loading = authLoading || queryPending;

  const backHref = fromProfile && advice
    ? `/profile/${advice.analyzed_username}`
    : "/advisor";
  const backLabel = fromProfile && advice ? "back to profile" : "back to advisor";

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
    );
  }

  if (error || !advice) {
    return (
      <div>
        <BackLink href="/advisor" label="back to advisor" hoverColor="hover:text-emerald-400" />
        <ErrorCard
          message="Advice not found"
          detail="This advice may have been deleted or you don't have access to it."
          variant="neutral"
        />
      </div>
    );
  }

  return (
    <div>
      <BackLink href={backHref} label={backLabel} hoverColor="hover:text-emerald-400" />
      <AdviceReport
        username={advice.analyzed_username}
        data={advice.advice_data}
      />
    </div>
  );
}

import { AdviceReport } from "@/components/advice/advice-report";
import { serverFetch } from "@/lib/server-api";
import { BackLink } from "@/components/ui/back-link";
import { ErrorCard } from "@/components/ui/error-card";
import type { AdviceData } from "@shared/types/advice";

interface AdviceRow {
  id: string;
  analyzed_username: string;
  advice_data: AdviceData;
}

export default async function AdvicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  const fromProfile = from === "profile";

  const advice = await serverFetch<AdviceRow>(`/advice/${id}`);

  if (!advice) {
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

  const backHref = fromProfile
    ? `/profile/${advice.analyzed_username}`
    : "/advisor";
  const backLabel = fromProfile ? "back to profile" : "back to advisor";

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

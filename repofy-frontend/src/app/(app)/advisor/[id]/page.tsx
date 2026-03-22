import { redirect } from "next/navigation";
import { AdviceReport } from "@/components/advice/advice-report";
import { serverFetch } from "@/lib/server-api";
import { BackLink } from "@/components/ui/back-link";
import { ErrorCard } from "@/components/ui/error-card";
import type { AdviceData } from "@shared/types/advice";

interface AdviceRow {
  id: string;
  analyzed_username: string;
  avatar_url: string | null;
  advice_data: AdviceData;
}

const errorMessages = {
  "not-found": { message: "Advice not found", detail: "This advice may have been deleted.", variant: "neutral" as const },
  "forbidden": { message: "Access denied", detail: "You don't have permission to view this advice.", variant: "error" as const },
  "server-error": { message: "Something went wrong", detail: "Please try again later.", variant: "error" as const },
};

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

  const { data: advice, error } = await serverFetch<AdviceRow>(`/advice/${id}`, { revalidate: 3600 });

  if (error === "unauthenticated") redirect("/login");

  if (error) {
    const { message, detail, variant } = errorMessages[error];
    return (
      <div>
        <BackLink href="/advisor" label="back to advisor" hoverColor="hover:text-emerald-400" />
        <ErrorCard message={message} detail={detail} variant={variant} />
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
        avatarUrl={advice.avatar_url ?? undefined}
        data={advice.advice_data}
      />
    </div>
  );
}

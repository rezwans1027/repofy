import { notFound } from "next/navigation";
import { z } from "zod";
import { ReadinessReport } from "@/components/readiness/readiness-report";
export default async function ReportPage({ params, searchParams }: { params: Promise<{ reportId: string }>; searchParams: Promise<{ evidence?: string }> }) {
  const { reportId } = await params; if (!z.uuid().safeParse(reportId).success) notFound();
  const { evidence } = await searchParams; if (evidence && !z.uuid().safeParse(evidence).success) notFound();
  return <ReadinessReport reportId={reportId} evidenceId={evidence} />;
}

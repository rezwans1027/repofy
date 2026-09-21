import { notFound } from "next/navigation";
import { z } from "zod";
import { ReportComparison } from "@/components/readiness/report-comparison";
export default async function ComparisonPage({ params }: { params: Promise<{ reportId: string; targetId: string }> }) {
  const { reportId, targetId } = await params;
  if (!z.uuid().safeParse(reportId).success || !z.uuid().safeParse(targetId).success) notFound();
  return <ReportComparison baselineId={reportId} targetId={targetId} />;
}

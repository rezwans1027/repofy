import { notFound } from "next/navigation";
import { z } from "zod";
import { AnalysisProgress } from "@/components/readiness/analysis-progress";
export default async function AnalysisPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params; if (!z.uuid().safeParse(jobId).success) notFound();
  return <AnalysisProgress jobId={jobId} />;
}

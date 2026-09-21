import { notFound, redirect } from "next/navigation";
import { z } from "zod";
export default async function ReportAlias({ params }: { params: Promise<{ reportId: string }> }) {
  const { reportId } = await params; if (!z.uuid().safeParse(reportId).success) notFound();
  redirect(`/readiness/reports/${reportId}`);
}

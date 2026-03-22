import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { ComingSoonCard } from "@/components/ui/coming-soon-card";

export const metadata: Metadata = {
  title: "Evals",
  description:
    "AI-powered candidate evaluations — generate hiring-grade reports with scores, radar charts, and interview questions.",
};

export default function ReportsPage() {
  return (
    <ComingSoonCard
      icon={FileText}
      title="Evals"
      description="AI-powered candidate evaluations are coming soon. You'll be able to generate hiring-grade reports with scores, radar charts, and interview questions."
    />
  );
}

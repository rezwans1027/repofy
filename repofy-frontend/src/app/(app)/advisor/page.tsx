import type { Metadata } from "next";
import { AdvisorListContent } from "@/components/advisor/advisor-list-content";

export const metadata: Metadata = {
  title: "Advisor",
  description:
    "AI-powered career advisor — view your personalized growth reports and 12-week roadmaps.",
};

export default function AdvisorPage() {
  return <AdvisorListContent />;
}

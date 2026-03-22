import type { Metadata } from "next";
import { GitCompareArrows } from "lucide-react";
import { ComingSoonCard } from "@/components/ui/coming-soon-card";

export const metadata: Metadata = {
  title: "Compare",
  description:
    "Side-by-side candidate comparison — compare radar charts, stats, strengths, and weaknesses across two developers.",
};

export default function ComparePage() {
  return (
    <ComingSoonCard
      icon={<GitCompareArrows className="mx-auto size-10 text-muted-foreground/30" />}
      title="Compare"
      description="Side-by-side candidate comparison is coming soon. Compare radar charts, stats, strengths, and weaknesses across two developers."
    />
  );
}

import { GitCompareArrows } from "lucide-react";
import { ComingSoonCard } from "@/components/ui/coming-soon-card";

export default function ComparePage() {
  return (
    <ComingSoonCard
      icon={GitCompareArrows}
      title="Compare"
      description="Side-by-side candidate comparison is coming soon. Compare radar charts, stats, strengths, and weaknesses across two developers."
    />
  );
}

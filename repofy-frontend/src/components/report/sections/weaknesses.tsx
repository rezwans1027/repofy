import { AlertTriangle } from "lucide-react";
import { AnimateOnView } from "@/components/ui/animate-on-view";
import { SectionHeader } from "@/components/ui/section-header";
import { EvidenceList } from "@/components/ui/evidence-list";
import type { ReportData } from "@/types/report";

interface WeaknessesProps {
  weaknesses: ReportData["weaknesses"];
}

export function Weaknesses({ weaknesses }: WeaknessesProps) {
  return (
    <AnimateOnView delay={0.42} className="h-full">
      <div className="rounded-lg border border-border bg-card p-5 h-full">
        <SectionHeader title="Areas for Improvement" />
        <EvidenceList items={weaknesses} icon={AlertTriangle} iconColor="text-yellow-400" />
      </div>
    </AnimateOnView>
  );
}

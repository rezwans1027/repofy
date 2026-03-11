import { Check } from "lucide-react";
import { AnimateOnView } from "@/components/ui/animate-on-view";
import { SectionHeader } from "@/components/ui/section-header";
import { EvidenceList } from "@/components/ui/evidence-list";
import type { ReportData } from "@shared/types/report";

interface StrengthsProps {
  strengths: ReportData["strengths"];
}

export function Strengths({ strengths }: StrengthsProps) {
  return (
    <AnimateOnView delay={0.42} className="h-full">
      <div className="rounded-lg border border-border bg-card p-5 h-full">
        <SectionHeader title="Strengths" />
        <EvidenceList items={strengths} icon={Check} iconColor="text-emerald-400" />
      </div>
    </AnimateOnView>
  );
}

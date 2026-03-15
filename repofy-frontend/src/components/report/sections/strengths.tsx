import { Check } from "lucide-react";
import { SectionCard } from "@/components/ui/section-card";
import { EvidenceList } from "@/components/ui/evidence-list";
import type { ReportData } from "@shared/types/report";

interface StrengthsProps {
  strengths: ReportData["strengths"];
}

export function Strengths({ strengths }: StrengthsProps) {
  return (
    <SectionCard delay={0.42} className="h-full" cardClassName="h-full" title="Strengths">
      <EvidenceList items={strengths} icon={Check} iconColor="text-emerald-400" />
    </SectionCard>
  );
}

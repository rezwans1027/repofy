import { AlertTriangle } from "lucide-react";
import { SectionCard } from "@/components/ui/section-card";
import { EvidenceList } from "@/components/ui/evidence-list";
import type { ReportData } from "@shared/types/report";

interface WeaknessesProps {
  weaknesses: ReportData["weaknesses"];
}

export function Weaknesses({ weaknesses }: WeaknessesProps) {
  return (
    <SectionCard delay={0.42} className="h-full" cardClassName="h-full" title="Areas for Improvement">
      <EvidenceList items={weaknesses} icon={AlertTriangle} iconColor="text-yellow-400" />
    </SectionCard>
  );
}

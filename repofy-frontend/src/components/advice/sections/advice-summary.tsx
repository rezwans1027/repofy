import { AnimateOnView } from "@/components/ui/animate-on-view";
import { SectionHeader } from "@/components/ui/section-header";

interface AdviceSummaryProps {
  summary: string;
}

export function AdviceSummary({ summary }: AdviceSummaryProps) {
  return (
    <AnimateOnView delay={0.06}>
      <div className="rounded-lg border border-border bg-card p-5">
        <SectionHeader title="Summary" />
        <div className="border-l-2 border-emerald-400/40 pl-4">
          <p className="text-sm leading-relaxed text-muted-foreground">
            {summary}
          </p>
        </div>
      </div>
    </AnimateOnView>
  );
}

import { AnimateOnView } from "@/components/ui/animate-on-view";
import { SectionHeader } from "@/components/ui/section-header";

interface SummaryProps {
  summary: string;
}

export function Summary({ summary }: SummaryProps) {
  return (
    <AnimateOnView delay={0.06}>
      <div className="rounded-lg border border-border bg-card p-5">
        <SectionHeader title="Executive Summary" />
        <div className="border-l-2 border-cyan/40 pl-4">
          <p className="text-sm leading-relaxed text-muted-foreground">
            {summary}
          </p>
        </div>
      </div>
    </AnimateOnView>
  );
}

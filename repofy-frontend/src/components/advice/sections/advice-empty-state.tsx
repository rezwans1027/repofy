import { AnimateOnView } from "@/components/ui/animate-on-view";
import { SectionHeader } from "@/components/ui/section-header";

interface AdviceEmptyStateProps { title: string; message: string; delay?: number }

export function AdviceEmptyState({ title, message, delay = 0.08 }: AdviceEmptyStateProps) {
  return (
    <AnimateOnView delay={delay}>
      <div className="rounded-lg border border-border bg-card p-5">
        <SectionHeader title={title} />
        <p className="text-xs text-muted-foreground">{message}</p>
      </div>
    </AnimateOnView>
  );
}

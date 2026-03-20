import { SectionCard } from "@/components/ui/section-card";

interface AdviceEmptyStateProps { title: string; message: string; delay?: number }

export function AdviceEmptyState({ title, message, delay = 0.08 }: AdviceEmptyStateProps) {
  return (
    <SectionCard delay={delay} title={title}>
      <p className="text-xs text-muted-foreground">{message}</p>
    </SectionCard>
  );
}

import { AnimateOnView } from "@/components/ui/animate-on-view";
import { SectionHeader } from "@/components/ui/section-header";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface SectionCardProps {
  delay: number;
  title: string;
  subtitle?: string;
  className?: string;
  cardClassName?: string;
  children: ReactNode;
  "data-testid"?: string;
}

export function SectionCard({
  delay,
  title,
  subtitle,
  className,
  cardClassName,
  children,
  "data-testid": testId,
}: SectionCardProps) {
  return (
    <AnimateOnView delay={delay} className={className}>
      <div
        className={cn("rounded-lg border border-border bg-card p-5", cardClassName)}
        data-testid={testId}
      >
        <SectionHeader title={title} subtitle={subtitle} />
        {children}
      </div>
    </AnimateOnView>
  );
}

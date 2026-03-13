import { AnimateOnView } from "@/components/ui/animate-on-view";
import { SectionHeader } from "@/components/ui/section-header";
import { stripMarkdown } from "@/lib/format";

interface SummaryProps {
  narrativeReport: string;
}

export function Summary({ narrativeReport }: SummaryProps) {
  const paragraphs = stripMarkdown(narrativeReport)
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\n/g, " ").trim())
    .filter((p) => p.length > 0);

  return (
    <AnimateOnView delay={0.06}>
      <div className="rounded-lg border border-border bg-card p-5">
        <SectionHeader title="Executive Summary" />
        <div className="border-l-2 border-cyan/40 pl-4 space-y-3">
          {paragraphs.map((paragraph, i) => (
            <p key={i} className="text-sm leading-relaxed text-muted-foreground">
              {paragraph}
            </p>
          ))}
        </div>
      </div>
    </AnimateOnView>
  );
}

import { Rocket } from "lucide-react";
import { AnimateOnView } from "@/components/ui/animate-on-view";
import { SectionHeader } from "@/components/ui/section-header";
import { Badge } from "@/components/ui/badge";
import { DIFFICULTY_STYLES } from "@/lib/styles";
import type { AdviceData } from "@/components/advice/advice-report";

interface BuildRoadmapProps {
  builds: AdviceData["buildRoadmap"];
}

export function BuildRoadmap({ builds }: BuildRoadmapProps) {
  return (
    <AnimateOnView delay={0.12}>
      <div className="rounded-lg border border-border bg-card p-5">
        <SectionHeader
          title="Build Roadmap"
          subtitle="3 portfolio projects to fill your gaps"
        />
        <div className="space-y-4">
          {builds.map((build, i) => (
            <div
              key={build.title}
              className="rounded-md border border-border bg-background p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Rocket className="size-4 shrink-0 text-emerald-400" />
                  <h3 className="font-mono text-sm font-bold">
                    <span className="text-emerald-400 mr-1.5">#{i + 1}</span>
                    {build.title}
                  </h3>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge className={`border text-[9px] ${DIFFICULTY_STYLES[build.difficulty] ?? ""}`}>
                    {build.difficulty}
                  </Badge>
                  <Badge variant="secondary" className="text-[9px]">
                    {build.estimatedWeeks}w
                  </Badge>
                </div>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                {build.projectOutcome}
              </p>

              <div className="flex flex-wrap gap-1.5">
                {build.techStack.map((tech) => (
                  <Badge key={tech} variant="secondary" className="text-[10px]">
                    {tech}
                  </Badge>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Milestones
                  </span>
                  <ul className="mt-1 space-y-1">
                    {build.milestones.map((m, j) => (
                      <li key={j} className="text-xs text-muted-foreground flex gap-1.5">
                        <span className="text-emerald-400 shrink-0">{j + 1}.</span>
                        {m}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Hiring Signals
                  </span>
                  <ul className="mt-1 space-y-1">
                    {build.hiringSignals.map((s, j) => (
                      <li key={j} className="text-xs text-muted-foreground flex gap-1.5">
                        <span className="text-emerald-400 shrink-0">•</span>
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="border-l-2 border-emerald-400/30 pl-3">
                <p className="text-[11px] text-muted-foreground">
                  <span className="text-emerald-400 font-medium">Evidence: </span>
                  {build.evidence}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AnimateOnView>
  );
}

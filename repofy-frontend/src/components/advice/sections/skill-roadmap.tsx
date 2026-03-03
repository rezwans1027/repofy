import { AnimateOnView } from "@/components/ui/animate-on-view";
import { SectionHeader } from "@/components/ui/section-header";
import { Badge } from "@/components/ui/badge";
import { DEMAND_STYLES } from "@/lib/styles";
import type { AdviceData } from "@/components/advice/advice-report";

const PRIORITY_STYLES: Record<string, string> = {
  Now: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  Next: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  Later: "bg-blue-500/15 text-blue-400 border-blue-500/30",
};

interface SkillRoadmapProps {
  skills: AdviceData["skillRoadmap"];
}

export function SkillRoadmap({ skills }: SkillRoadmapProps) {
  if (skills.length === 0) {
    return (
      <AnimateOnView delay={0.24}>
        <div className="rounded-lg border border-border bg-card p-5">
          <SectionHeader title="Skill Roadmap" />
          <p className="text-xs text-muted-foreground">No skill suggestions available — your stack already covers the key areas.</p>
        </div>
      </AnimateOnView>
    );
  }

  return (
    <AnimateOnView delay={0.24}>
      <div className="rounded-lg border border-border bg-card p-5">
        <SectionHeader
          title="Skill Roadmap"
          subtitle="Based on your stack and market demand"
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {skills.map((skill) => (
            <div
              key={skill.skill}
              className="rounded-md border border-border bg-background p-4 space-y-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-mono text-sm font-bold min-w-0">{skill.skill}</h3>
                <div className="flex items-center gap-1.5">
                  <Badge className={`border text-[9px] ${PRIORITY_STYLES[skill.priority] ?? ""}`}>
                    {skill.priority}
                  </Badge>
                  <Badge className={`border text-[9px] ${DEMAND_STYLES[skill.demandLevel] ?? ""}`}>
                    {skill.demandLevel}
                  </Badge>
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {skill.reason}
              </p>
              <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground">
                  <span className="text-emerald-400">Related to:</span> {skill.relatedTo}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  <span className="text-emerald-400">Proof:</span> {skill.proofOfLearning}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AnimateOnView>
  );
}

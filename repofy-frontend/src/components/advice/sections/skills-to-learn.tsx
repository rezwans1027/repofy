import { AnimateOnView } from "@/components/ui/animate-on-view";
import { SectionHeader } from "@/components/ui/section-header";
import { Badge } from "@/components/ui/badge";
import { DEMAND_STYLES } from "@/lib/styles";
import type { AdviceData } from "@/components/advice/advice-report";

interface SkillsToLearnProps {
  skills: AdviceData["skillsToLearn"];
}

export function SkillsToLearn({ skills }: SkillsToLearnProps) {
  return (
    <AnimateOnView delay={0.24}>
      <div className="rounded-lg border border-border bg-card p-5">
        <SectionHeader
          title="Skills to Learn"
          subtitle="Based on your stack and market demand"
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {skills.map((skill) => (
            <div
              key={skill.skill}
              className="rounded-md border border-border bg-background p-4 space-y-2"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-mono text-sm font-bold">{skill.skill}</h3>
                <Badge className={`border text-[9px] ${DEMAND_STYLES[skill.demandLevel] ?? ""}`}>
                  {skill.demandLevel} Demand
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {skill.reason}
              </p>
              <p className="text-[11px] text-muted-foreground">
                <span className="text-emerald-400">Related to:</span>{" "}
                {skill.relatedTo}
              </p>
            </div>
          ))}
        </div>
      </div>
    </AnimateOnView>
  );
}

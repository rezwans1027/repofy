import { Rocket } from "lucide-react";
import { AnimateOnView } from "@/components/ui/animate-on-view";
import { SectionHeader } from "@/components/ui/section-header";
import { Badge } from "@/components/ui/badge";
import { DIFFICULTY_STYLES } from "@/lib/styles";
import type { AdviceData } from "@/components/advice/advice-report";

interface ProjectIdeasProps {
  projectIdeas: AdviceData["projectIdeas"];
}

export function ProjectIdeas({ projectIdeas }: ProjectIdeasProps) {
  return (
    <AnimateOnView delay={0.12}>
      <div className="rounded-lg border border-border bg-card p-5">
        <SectionHeader
          title="Project Ideas"
          subtitle="Build these to level up your profile"
        />
        <div className="grid gap-3 lg:grid-cols-2">
          {projectIdeas.map((idea) => (
            <div
              key={idea.title}
              className="rounded-md border border-border bg-background p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Rocket className="size-4 shrink-0 text-emerald-400" />
                  <h3 className="font-mono text-sm font-bold">{idea.title}</h3>
                </div>
                <Badge className={`border text-[9px] shrink-0 ${DIFFICULTY_STYLES[idea.difficulty] ?? ""}`}>
                  {idea.difficulty}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {idea.description}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {idea.techStack.map((tech) => (
                  <Badge
                    key={tech}
                    variant="secondary"
                    className="text-[10px]"
                  >
                    {tech}
                  </Badge>
                ))}
              </div>
              <div className="border-l-2 border-emerald-400/30 pl-3">
                <p className="text-[11px] text-muted-foreground">
                  <span className="text-emerald-400 font-medium">Why: </span>
                  {idea.why}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AnimateOnView>
  );
}

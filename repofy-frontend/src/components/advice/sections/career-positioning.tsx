import { Briefcase, Star } from "lucide-react";
import { AnimateOnView } from "@/components/ui/animate-on-view";
import { SectionHeader } from "@/components/ui/section-header";
import { Badge } from "@/components/ui/badge";
import type { AdviceData } from "@/components/advice/advice-report";

interface CareerPositioningProps {
  data: AdviceData["careerPositioning"];
}

export function CareerPositioning({ data }: CareerPositioningProps) {
  const empty = !data.positioning && data.roles.length === 0;

  if (empty) {
    return (
      <AnimateOnView delay={0.16}>
        <div className="rounded-lg border border-border bg-card p-5">
          <SectionHeader title="Career Positioning" />
          <p className="text-xs text-muted-foreground">No career positioning available.</p>
        </div>
      </AnimateOnView>
    );
  }

  return (
    <AnimateOnView delay={0.16}>
      <div className="rounded-lg border border-border bg-card p-5">
        <SectionHeader
          title="Career Positioning"
          subtitle="How to frame yourself for job applications"
        />
        <div className="space-y-4">
          {/* Positioning narrative */}
          <div className="border-l-2 border-emerald-400/30 pl-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              {data.positioning}
            </p>
          </div>

          {/* Fitting roles */}
          {data.roles.length > 0 && (
            <div className="space-y-2">
              <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-400">
                Fitting Roles
              </span>
              <div className="flex flex-wrap gap-2">
                {data.roles.map((role) => (
                  <Badge
                    key={role}
                    className="border bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[11px]"
                  >
                    <Briefcase className="size-3 mr-1.5" />
                    {role}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Differentiators */}
          {data.differentiators.length > 0 && (
            <div className="space-y-2">
              <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-400">
                What Sets You Apart
              </span>
              {data.differentiators.map((d) => (
                <div key={d} className="flex gap-3 rounded-md border border-border bg-background p-3">
                  <Star className="size-4 shrink-0 text-amber-400 mt-0.5" />
                  <p className="text-xs leading-relaxed">{d}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AnimateOnView>
  );
}

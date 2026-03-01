import { Compass } from "lucide-react";
import { AnimateOnView } from "@/components/ui/animate-on-view";
import { SectionHeader } from "@/components/ui/section-header";
import { Badge } from "@/components/ui/badge";
import type { AdviceData } from "@/components/advice/advice-report";

const CONFIDENCE_STYLES: Record<string, string> = {
  High: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  Medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  Low: "bg-red-500/15 text-red-400 border-red-500/30",
};

const LEVEL_STYLES: Record<string, string> = {
  Junior: "text-blue-400",
  "Mid-Level": "text-cyan",
  Senior: "text-emerald-400",
  Staff: "text-amber-400",
};

interface TrajectoryProps {
  trajectory: AdviceData["trajectory"];
}

export function TrajectorySection({ trajectory }: TrajectoryProps) {
  const calibrationEntries = [
    { label: "Complexity", value: trajectory.calibration.complexity },
    { label: "Breadth", value: trajectory.calibration.breadth },
    { label: "Collaboration", value: trajectory.calibration.collaboration },
    { label: "Eng. Practices", value: trajectory.calibration.engineeringPractices },
    { label: "Consistency", value: trajectory.calibration.consistency },
  ];

  return (
    <AnimateOnView delay={0.08}>
      <div className="rounded-lg border border-border bg-card p-5">
        <SectionHeader
          title="Career Trajectory"
          subtitle="Estimated level and growth path"
        />
        <div className="space-y-4">
          {/* Level badges */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Compass className="size-4 text-emerald-400" />
              <span className="font-mono text-xs text-muted-foreground">Current:</span>
              <span className={`font-mono text-sm font-bold ${LEVEL_STYLES[trajectory.currentEstimate] ?? "text-foreground"}`}>
                {trajectory.currentEstimate}
              </span>
            </div>
            <span className="text-muted-foreground">→</span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">Target:</span>
              <span className={`font-mono text-sm font-bold ${LEVEL_STYLES[trajectory.targetEstimate] ?? "text-foreground"}`}>
                {trajectory.targetEstimate}
              </span>
            </div>
            <Badge className={`border text-[9px] ${CONFIDENCE_STYLES[trajectory.confidence] ?? ""}`}>
              {trajectory.confidence} confidence
            </Badge>
          </div>

          {/* Rationale */}
          <div className="border-l-2 border-emerald-400/30 pl-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              {trajectory.rationale}
            </p>
          </div>

          {/* Calibration grid */}
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {calibrationEntries.map((entry) => (
              <div
                key={entry.label}
                className="rounded-md border border-border bg-background p-3"
              >
                <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-400">
                  {entry.label}
                </span>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  {entry.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AnimateOnView>
  );
}

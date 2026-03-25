"use client";

import { AnimateOnView } from "@/components/ui/animate-on-view";
import { SectionHeader } from "@/components/ui/section-header";

interface Collaborator {
  username: string;
  initials: string;
  contributions: number;
}

interface TopCollaboratorsProps {
  collaborators: Collaborator[];
}

export function TopCollaborators({ collaborators }: TopCollaboratorsProps) {
  return (
    <AnimateOnView delay={0.18}>
      <SectionHeader title="Top Collaborators" />
      <div className="flex flex-wrap gap-3">
        {collaborators.map((collab) => (
          <div
            key={collab.username}
            className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary font-mono text-xs font-bold text-cyan">
              {collab.initials}
            </div>
            <div>
              <p className="font-mono text-xs font-bold text-foreground">
                @{collab.username}
              </p>
              <p className="font-mono text-[10px] text-muted-foreground">
                {collab.contributions} contributions
              </p>
            </div>
          </div>
        ))}
      </div>
    </AnimateOnView>
  );
}

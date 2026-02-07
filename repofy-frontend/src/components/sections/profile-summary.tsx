"use client";

import { demoProfile, contributionDensity } from "@/lib/demo-data";
import { SectionHeader } from "@/components/ui/section-header";
import { AnimateOnView } from "@/components/ui/animate-on-view";
import { Badge } from "@/components/ui/badge";

export function ProfileSummary() {
  const maxDensity = Math.max(...contributionDensity.map((d) => d.value));

  return (
    <section id="profile-summary" className="py-20">
      <AnimateOnView>
        <SectionHeader
          title="Profile Summary"
          subtitle="git log --oneline --author=alexchendev"
        />
      </AnimateOnView>

      <AnimateOnView delay={0.1}>
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-start gap-4">
            {/* Avatar placeholder */}
            <div className="bg-cyan/10 border-cyan/30 flex h-16 w-16 shrink-0 items-center justify-center rounded-full border font-mono text-lg text-cyan">
              {demoProfile.name
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="font-mono text-lg font-bold">{demoProfile.name}</h3>
              <p className="text-cyan font-mono text-sm">
                @{demoProfile.username}
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                {demoProfile.bio}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <Badge variant="secondary" className="font-mono text-xs">
                  {demoProfile.repos} repos
                </Badge>
                <Badge variant="secondary" className="font-mono text-xs">
                  {demoProfile.stars.toLocaleString()} stars
                </Badge>
                <Badge variant="secondary" className="font-mono text-xs">
                  {demoProfile.followers} followers
                </Badge>
                <Badge variant="secondary" className="font-mono text-xs">
                  {demoProfile.contributions.toLocaleString()} contributions
                </Badge>
                <Badge variant="secondary" className="font-mono text-xs">
                  since {demoProfile.joinedYear}
                </Badge>
              </div>
            </div>
          </div>

          {/* Contribution density bar */}
          <div className="mt-6">
            <p className="text-muted-foreground mb-2 font-mono text-xs">
              Contribution density
            </p>
            <div className="flex gap-1">
              {contributionDensity.map((d) => (
                <div key={d.month} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-sm"
                    style={{
                      height: `${(d.value / maxDensity) * 48}px`,
                      backgroundColor: `rgba(34, 211, 238, ${0.2 + (d.value / maxDensity) * 0.8})`,
                    }}
                  />
                  <span className="text-muted-foreground text-[9px]">
                    {d.month.slice(0, 1)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </AnimateOnView>
    </section>
  );
}

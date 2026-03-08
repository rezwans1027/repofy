/**
 * Clean, document-style PDF layout for the advice report.
 * Designed for paper — no cards, badges, or web UI chrome.
 */
import type { AdviceData } from "@/types/advice";
import { Divider, Heading } from "@/components/ui/pdf-primitives";

interface PdfLayoutProps {
  username: string;
  data: AdviceData;
}

export function AdviceReportPdfLayout({ username, data }: PdfLayoutProps) {
  return (
    <div
      data-pdf-sections
      className="font-sans text-foreground"
      style={{ fontSize: "13px", lineHeight: "1.65" }}
    >
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="pb-5 mb-5 border-b-2 border-foreground/15">
        <h1 className="text-[22px] font-bold tracking-tight leading-tight">
          Career Advice Report
        </h1>
        <p className="text-[15px] text-muted-foreground mt-1">@{username}</p>
      </div>

      {/* ── Summary ────────────────────────────────────────── */}
      <div className="mb-5">
        <Heading>Summary</Heading>
        <p className="text-muted-foreground">{data.summary}</p>
      </div>

      <Divider />

      {/* ── Career Trajectory ──────────────────────────────── */}
      <div className="py-5">
        <Heading>Career Trajectory</Heading>
        <div className="flex items-baseline gap-3 mb-3">
          <span className="font-semibold text-[14px]">
            {data.trajectory.currentEstimate}
          </span>
          <span className="text-muted-foreground text-[12px]">→</span>
          <span className="font-semibold text-[14px]">
            {data.trajectory.targetEstimate}
          </span>
          <span className="text-[11px] text-muted-foreground ml-2">
            Confidence: {data.trajectory.confidence}
          </span>
        </div>
        <p className="text-[12px] text-muted-foreground mb-3">
          {data.trajectory.rationale}
        </p>
        <div className="grid grid-cols-5 gap-3">
          {(
            Object.entries(data.trajectory.calibration) as [string, string][]
          ).map(([key, val]) => (
            <div key={key} className="border-b border-foreground/5 pb-1">
              <div className="text-[10px] text-muted-foreground capitalize">
                {key.replace(/([A-Z])/g, " $1").trim()}
              </div>
              <div className="text-[12px] font-medium">{val}</div>
            </div>
          ))}
        </div>
      </div>

      <Divider />

      {/* ── Strengths & Gaps ───────────────────────────────── */}
      <div className="py-5 grid grid-cols-2 gap-8">
        <div>
          <Heading>Strengths</Heading>
          <ul className="space-y-2">
            {data.strengthsAndGaps.strengths.map((s, i) => (
              <li key={i}>
                <p className="text-[12px] font-medium">{s.area}</p>
                <p className="text-[11px] text-muted-foreground">{s.detail}</p>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <Heading>Gaps</Heading>
          <ul className="space-y-2">
            {data.strengthsAndGaps.gaps.map((g, i) => (
              <li key={i}>
                <p className="text-[12px] font-medium">{g.area}</p>
                <p className="text-[11px] text-muted-foreground">{g.detail}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <Divider />

      {/* ── Career Positioning ─────────────────────────────── */}
      <div className="py-5">
        <Heading>Career Positioning</Heading>
        <p className="text-[12px] text-muted-foreground mb-3">
          {data.careerPositioning.positioning}
        </p>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">
              Target Roles
            </p>
            <ul className="space-y-0.5">
              {data.careerPositioning.roles.map((role, i) => (
                <li key={i} className="text-[12px]">
                  {role}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">
              Differentiators
            </p>
            <ul className="space-y-0.5">
              {data.careerPositioning.differentiators.map((d, i) => (
                <li key={i} className="text-[12px]">
                  {d}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <Divider />

      {/* ── Build Roadmap ──────────────────────────────────── */}
      <div className="py-5">
        <Heading>Build Roadmap</Heading>
        <div className="space-y-4">
          {data.buildRoadmap.map((build, i) => (
            <div key={i} className="border-b border-foreground/5 pb-3">
              <div className="flex items-baseline justify-between">
                <span className="text-[13px] font-semibold">{build.title}</span>
                <span className="text-[11px] text-muted-foreground">
                  {build.difficulty} · ~{build.estimatedWeeks} weeks
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {build.projectOutcome}
              </p>
              <div className="flex gap-2 mt-1.5 flex-wrap">
                {build.techStack.map((tech) => (
                  <span
                    key={tech}
                    className="text-[10px] text-muted-foreground"
                  >
                    {tech}
                  </span>
                ))}
              </div>
              <div className="mt-2">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                  Milestones
                </p>
                <ol className="space-y-0.5">
                  {build.milestones.map((m, j) => (
                    <li key={j} className="text-[11px] text-muted-foreground flex gap-2">
                      <span className="tabular-nums shrink-0">{j + 1}.</span>
                      {m}
                    </li>
                  ))}
                </ol>
              </div>
              {build.hiringSignals.length > 0 && (
                <div className="mt-2">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                    Hiring Signals
                  </p>
                  <ul className="space-y-0.5">
                    {build.hiringSignals.map((s, j) => (
                      <li key={j} className="text-[11px] text-muted-foreground">
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <Divider />

      {/* ── Weekly Roadmap ──────────────────────────────────── */}
      {data.weeklyRoadmap.length > 0 && (
        <>
          <div className="py-5">
            <Heading>Weekly Plan</Heading>
            <div className="space-y-2.5">
              {data.weeklyRoadmap.map((week) => (
                <div
                  key={week.week}
                  className="border-b border-foreground/5 pb-2"
                >
                  <div className="flex items-baseline justify-between">
                    <span className="text-[12px] font-semibold">
                      Week {week.week}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {week.activeBuildTitle}
                    </span>
                  </div>
                  <p className="text-[11px] font-medium mt-0.5">{week.focus}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Deliverable: {week.deliverable}
                  </p>
                  <div className="flex gap-4 mt-1 text-[10px] text-muted-foreground">
                    <span>Skill: {week.skillTask}</span>
                    <span>Check: {week.successCheck}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <Divider />
        </>
      )}

      {/* ── Success Metrics ────────────────────────────────── */}
      <div className="py-5">
        <Heading>Success Metrics</Heading>
        <ul className="space-y-1">
          {data.successMetrics.map((metric, i) => (
            <li key={i} className="text-[12px] text-muted-foreground flex gap-2">
              <span className="shrink-0">•</span>
              {metric}
            </li>
          ))}
        </ul>
      </div>

      <Divider />

      {/* ── Skill Roadmap ──────────────────────────────────── */}
      <div className="py-5">
        <Heading>Skill Roadmap</Heading>
        <div className="space-y-2.5">
          {data.skillRoadmap.map((skill, i) => (
            <div key={i} className="border-b border-foreground/5 pb-2">
              <div className="flex items-baseline justify-between">
                <span className="text-[12px] font-semibold">{skill.skill}</span>
                <span className="text-[10px] text-muted-foreground">
                  {skill.priority} · {skill.demandLevel} demand
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">{skill.reason}</p>
              <p className="text-[10px] text-muted-foreground italic mt-0.5">
                Proof: {skill.proofOfLearning}
              </p>
            </div>
          ))}
        </div>
      </div>

      <Divider />

      {/* ── Repository Improvements ────────────────────────── */}
      {data.repoImprovements.length > 0 && (
        <>
          <div className="py-5">
            <Heading>Repository Improvements</Heading>
            <div className="space-y-4">
              {data.repoImprovements.map((repo, i) => (
                <div key={i} className="border-b border-foreground/5 pb-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[13px] font-semibold">
                      {repo.repoName}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {repo.language}
                      {repo.stars != null && ` · ${repo.stars} stars`}
                    </span>
                  </div>
                  <div className="mt-1.5 space-y-1.5">
                    {repo.improvements.map((imp, j) => (
                      <div key={j} className="flex gap-2">
                        <span className="text-[10px] text-muted-foreground uppercase shrink-0 w-16">
                          [{imp.priority}]
                        </span>
                        <div>
                          <p className="text-[11px]">
                            <span className="font-medium">{imp.area}:</span>{" "}
                            {imp.suggestion}
                          </p>
                          <p className="text-[10px] text-muted-foreground italic">
                            {imp.expectedOutcome}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <Divider />
        </>
      )}

      {/* ── Contribution Strategy ──────────────────────────── */}
      <div className="py-5">
        <Heading>Contribution Strategy</Heading>
        <div className="space-y-2.5">
          {data.contributionStrategy.map((item, i) => (
            <div key={i}>
              <p className="text-[12px] font-medium">{item.title}</p>
              <p className="text-[11px] text-muted-foreground">{item.detail}</p>
            </div>
          ))}
        </div>
      </div>

      <Divider />

      {/* ── Profile Optimizations ──────────────────────────── */}
      <div className="py-5">
        <Heading>Profile Optimizations</Heading>
        <div className="space-y-3">
          {data.profileOptimizations.map((opt, i) => (
            <div key={i} className="border-b border-foreground/5 pb-2">
              <p className="text-[12px] font-semibold">{opt.area}</p>
              <div className="grid grid-cols-2 gap-4 mt-1 text-[11px]">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    Current
                  </span>
                  <p className="text-muted-foreground">{opt.current}</p>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    Suggested
                  </span>
                  <p>{opt.suggestion}</p>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground italic mt-1">
                Impact: {opt.impact}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

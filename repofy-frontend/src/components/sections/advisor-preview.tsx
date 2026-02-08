"use client";

import { AnimateOnView } from "@/components/ui/animate-on-view";
import { SectionHeader } from "@/components/ui/section-header";
import { Badge } from "@/components/ui/badge";
import {
  Rocket,
  Wrench,
  GraduationCap,
  Target,
  ArrowUpRight,
  TrendingUp,
} from "lucide-react";

const projectIdeas = [
  {
    title: "Distributed Task Queue",
    difficulty: "Advanced",
    stack: ["Rust", "Redis", "gRPC"],
    why: "Demonstrates systems expertise and distributed systems understanding",
  },
  {
    title: "OpenAPI Test Generator",
    difficulty: "Intermediate",
    stack: ["TypeScript", "Node.js", "Jest"],
    why: "Builds on ts-api-forge and addresses testing weakness",
  },
  {
    title: "GitHub Actions Toolkit",
    difficulty: "Beginner",
    stack: ["TypeScript", "YAML", "Docker"],
    why: "Quick CI/CD win that improves engineering practices score",
  },
];

const skillsToLearn = [
  { skill: "Kubernetes", demand: "High", relatedTo: "Docker & deployment" },
  { skill: "GraphQL", demand: "High", relatedTo: "REST API experience" },
  { skill: "Terraform", demand: "Growing", relatedTo: "Infrastructure work" },
];

const actionPlan = [
  {
    period: "30 days",
    color: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
    items: [
      "Add integration tests to ts-api-forge",
      "Update vulnerable dependencies",
      "Write comprehensive READMEs for top 5 repos",
    ],
  },
  {
    period: "60 days",
    color: "text-amber-400 border-amber-400/30 bg-amber-400/10",
    items: [
      "Build the distributed task queue project",
      "Contribute to 2 high-profile OSS repos",
      "Add CI/CD pipelines to untested repos",
    ],
  },
  {
    period: "90 days",
    color: "text-violet-400 border-violet-400/30 bg-violet-400/10",
    items: [
      "Publish a technical blog post",
      "Achieve 80%+ test coverage across all repos",
      "Complete Kubernetes certification",
    ],
  },
];

export function AdvisorPreview() {
  return (
    <section id="advisor" className="py-20">
      <AnimateOnView>
        <SectionHeader
          title="AI Profile Advisor"
          subtitle="Actionable career advice. Not generic tips — personalized to their actual code and gaps."
        />
      </AnimateOnView>

      {/* Project Ideas */}
      <AnimateOnView delay={0.1}>
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="mb-4 flex items-center gap-2">
            <Rocket className="h-4 w-4 text-emerald-400" />
            <span className="font-mono text-xs font-bold">
              Suggested Project Ideas
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {projectIdeas.map((project) => (
              <div
                key={project.title}
                className="rounded-md border border-border bg-background p-4"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold">
                    {project.title}
                  </span>
                </div>
                <Badge
                  variant="outline"
                  className={`mt-2 font-mono text-[9px] ${
                    project.difficulty === "Advanced"
                      ? "border-violet-400/30 text-violet-400"
                      : project.difficulty === "Intermediate"
                        ? "border-amber-400/30 text-amber-400"
                        : "border-emerald-400/30 text-emerald-400"
                  }`}
                >
                  {project.difficulty}
                </Badge>
                <div className="mt-3 flex flex-wrap gap-1">
                  {project.stack.map((tech) => (
                    <span
                      key={tech}
                      className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
                <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
                  {project.why}
                </p>
              </div>
            ))}
          </div>
        </div>
      </AnimateOnView>

      {/* Skills + Repo Improvements row */}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {/* Skills to Learn */}
        <AnimateOnView delay={0.15}>
          <div className="h-full rounded-lg border border-border bg-card p-5">
            <div className="mb-3 flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-emerald-400" />
              <span className="font-mono text-xs font-bold">Skills to Learn</span>
            </div>
            <div className="space-y-3">
              {skillsToLearn.map((s) => (
                <div
                  key={s.skill}
                  className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2"
                >
                  <div>
                    <span className="font-mono text-sm font-bold">{s.skill}</span>
                    <p className="text-muted-foreground text-[10px]">
                      Builds on: {s.relatedTo}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={`font-mono text-[9px] ${
                      s.demand === "High"
                        ? "border-emerald-400/30 text-emerald-400"
                        : "border-amber-400/30 text-amber-400"
                    }`}
                  >
                    {s.demand} Demand
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </AnimateOnView>

        {/* Repo Improvements */}
        <AnimateOnView delay={0.2}>
          <div className="h-full rounded-lg border border-border bg-card p-5">
            <div className="mb-3 flex items-center gap-2">
              <Wrench className="h-4 w-4 text-emerald-400" />
              <span className="font-mono text-xs font-bold">
                Repository Improvements
              </span>
            </div>
            <div className="space-y-3">
              {[
                {
                  repo: "rustic-kv",
                  area: "Testing",
                  suggestion: "Add property-based tests for key-value operations",
                  priority: "High",
                },
                {
                  repo: "ts-api-forge",
                  area: "Documentation",
                  suggestion: "Add API documentation with usage examples",
                  priority: "Medium",
                },
                {
                  repo: "commit-radar",
                  area: "Architecture",
                  suggestion: "Decouple frontend components from data fetching",
                  priority: "High",
                },
              ].map((item) => (
                <div
                  key={`${item.repo}-${item.area}`}
                  className="rounded-md border border-border bg-background px-3 py-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold">{item.repo}</span>
                    <div className="flex gap-1.5">
                      <Badge
                        variant="outline"
                        className="font-mono text-[9px] text-muted-foreground"
                      >
                        {item.area}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`font-mono text-[9px] ${
                          item.priority === "High"
                            ? "border-rose-400/30 text-rose-400"
                            : "border-amber-400/30 text-amber-400"
                        }`}
                      >
                        {item.priority}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-muted-foreground mt-1 text-[11px]">
                    {item.suggestion}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </AnimateOnView>
      </div>

      {/* 30-60-90 Day Action Plan */}
      <AnimateOnView delay={0.25}>
        <div className="mt-4 rounded-lg border border-border bg-card p-6">
          <div className="mb-4 flex items-center gap-2">
            <Target className="h-4 w-4 text-emerald-400" />
            <span className="font-mono text-xs font-bold">
              30-60-90 Day Action Plan
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {actionPlan.map((phase) => (
              <div
                key={phase.period}
                className={`rounded-md border p-4 ${phase.color}`}
              >
                <span className="font-mono text-sm font-bold">{phase.period}</span>
                <ul className="mt-3 space-y-2">
                  {phase.items.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2 text-xs text-muted-foreground"
                    >
                      <ArrowUpRight className="mt-0.5 h-3 w-3 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </AnimateOnView>

      <AnimateOnView delay={0.3}>
        <p className="text-muted-foreground mt-6 text-center font-mono text-xs">
          Advice also includes contribution habits analysis, profile optimizations,
          and an exportable PDF action plan.
        </p>
      </AnimateOnView>
    </section>
  );
}

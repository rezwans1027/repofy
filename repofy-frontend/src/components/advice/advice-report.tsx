"use client";

import { createContext, useContext, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ChevronDown,
  Rocket,
  TrendingUp,
  Target,
  Wrench,
  Calendar,
  ArrowUpRight,
  Star,
  RefreshCw,
  FileDown,
  Loader2,
} from "lucide-react";
import { AnimateOnView } from "@/components/ui/animate-on-view";
import { SectionHeader } from "@/components/ui/section-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface AdviceData {
  summary: string;
  projectIdeas: {
    title: string;
    description: string;
    techStack: string[];
    difficulty: "Beginner" | "Intermediate" | "Advanced";
    why: string;
  }[];
  repoImprovements: {
    repoName: string;
    repoUrl?: string | null;
    language?: string | null;
    languageColor?: string;
    stars?: number;
    improvements: {
      area: "Testing" | "Documentation" | "CI/CD" | "Code Quality" | "Architecture";
      suggestion: string;
      priority: "High" | "Medium" | "Low";
    }[];
  }[];
  skillsToLearn: {
    skill: string;
    reason: string;
    demandLevel: "High" | "Medium" | "Growing";
    relatedTo: string;
  }[];
  contributionAdvice: { title: string; detail: string }[];
  profileOptimizations: { area: string; current: string; suggestion: string }[];
  actionPlan: {
    timeframe: "30 days" | "60 days" | "90 days";
    actions: string[];
  }[];
}

const AdviceDataContext = createContext<AdviceData>({} as AdviceData);
function useAdviceData() {
  return useContext(AdviceDataContext);
}

// ── Section 1: Top Banner ──────────────────────────────────────────

function TopBanner({ username, avatarUrl }: { username: string; avatarUrl?: string }) {
  return (
    <AnimateOnView delay={0}>
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-center gap-4">
          <div className="relative">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={username}
                className="h-16 w-16 rounded-full border-2 border-emerald-400/30"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-emerald-400/30 bg-secondary font-mono text-xl font-bold text-emerald-400">
                {username.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <h1 className="font-mono text-lg font-bold tracking-tight">
              @{username}
            </h1>
            <p className="font-mono text-sm text-muted-foreground">
              Profile Advisor
            </p>
            <div className="mt-1.5">
              <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px]">
                Actionable Advice
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </AnimateOnView>
  );
}

// ── Section 2: Summary ─────────────────────────────────────────────

function Summary() {
  const data = useAdviceData();
  return (
    <AnimateOnView delay={0.06}>
      <div className="rounded-lg border border-border bg-card p-5">
        <SectionHeader title="Summary" />
        <div className="border-l-2 border-emerald-400/40 pl-4">
          <p className="text-sm leading-relaxed text-muted-foreground">
            {data.summary}
          </p>
        </div>
      </div>
    </AnimateOnView>
  );
}

// ── Section 3: Project Ideas ───────────────────────────────────────

function ProjectIdeas() {
  const data = useAdviceData();

  const difficultyStyle = {
    Beginner: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    Intermediate: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    Advanced: "bg-red-500/15 text-red-400 border-red-500/30",
  };

  return (
    <AnimateOnView delay={0.12}>
      <div className="rounded-lg border border-border bg-card p-5">
        <SectionHeader
          title="Project Ideas"
          subtitle="Build these to level up your profile"
        />
        <div className="grid gap-3 lg:grid-cols-2">
          {data.projectIdeas.map((idea, i) => (
            <div
              key={i}
              className="rounded-md border border-border bg-background p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Rocket className="size-4 shrink-0 text-emerald-400" />
                  <h3 className="font-mono text-sm font-bold">{idea.title}</h3>
                </div>
                <Badge className={`border text-[9px] shrink-0 ${difficultyStyle[idea.difficulty]}`}>
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

// ── Section 4: Repo Improvements ───────────────────────────────────

function RepoImprovements({ expandAll = false }: { expandAll?: boolean }) {
  const data = useAdviceData();
  const [expanded, setExpanded] = useState<string | null>(null);

  const priorityStyle = {
    High: "bg-red-500/15 text-red-400 border-red-500/30",
    Medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    Low: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  };

  return (
    <AnimateOnView delay={0.18}>
      <div className="rounded-lg border border-border bg-card p-5">
        <SectionHeader
          title="Repository Improvements"
          subtitle="Specific upgrades for your existing repos"
        />
        <div className="space-y-3">
          {data.repoImprovements.map((repo) => (
            <div
              key={repo.repoName}
              className="rounded-md border border-border bg-background overflow-hidden"
            >
              <button
                onClick={() =>
                  setExpanded(expanded === repo.repoName ? null : repo.repoName)
                }
                className="flex w-full items-center justify-between p-3 text-left hover:bg-secondary/30 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Wrench className="size-3.5 shrink-0 text-emerald-400" />
                  <span className="font-mono text-sm font-bold truncate">
                    {repo.repoName}
                  </span>
                  <Badge variant="secondary" className="text-[9px] shrink-0">
                    {repo.improvements.length} improvements
                  </Badge>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {repo.stars !== undefined && (
                    <span className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
                      <Star className="size-3" />
                      {repo.stars}
                    </span>
                  )}
                  <ChevronDown
                    className={`size-4 text-muted-foreground transition-transform ${
                      expanded === repo.repoName ? "rotate-180" : ""
                    }`}
                  />
                </div>
              </button>

              {(expandAll || expanded === repo.repoName) && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  transition={{ duration: 0.25 }}
                  className="border-t border-border"
                >
                  <div className="p-4 space-y-3">
                    {repo.improvements.map((imp, i) => (
                      <div key={i} className="flex gap-3">
                        <div className="mt-0.5 shrink-0">
                          <Badge className={`border text-[9px] w-14 justify-center ${priorityStyle[imp.priority]}`}>
                            {imp.priority}
                          </Badge>
                        </div>
                        <div>
                          <p className="text-xs font-medium">
                            <span className="text-muted-foreground">{imp.area}:</span>{" "}
                            {imp.suggestion}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </div>
          ))}
        </div>
      </div>
    </AnimateOnView>
  );
}

// ── Section 5: Skills to Learn ─────────────────────────────────────

function SkillsToLearn() {
  const data = useAdviceData();

  const demandStyle = {
    High: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    Medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    Growing: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  };

  return (
    <AnimateOnView delay={0.24}>
      <div className="rounded-lg border border-border bg-card p-5">
        <SectionHeader
          title="Skills to Learn"
          subtitle="Based on your stack and market demand"
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.skillsToLearn.map((skill, i) => (
            <div
              key={i}
              className="rounded-md border border-border bg-background p-4 space-y-2"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-mono text-sm font-bold">{skill.skill}</h3>
                <Badge className={`border text-[9px] ${demandStyle[skill.demandLevel]}`}>
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

// ── Section 6: Contribution Advice ─────────────────────────────────

function ContributionAdvice() {
  const data = useAdviceData();
  return (
    <AnimateOnView delay={0.3} className="h-full">
      <div className="rounded-lg border border-border bg-card p-5 h-full">
        <SectionHeader title="Contribution Advice" />
        <div className="space-y-3">
          {data.contributionAdvice.map((item, i) => (
            <div key={i} className="flex gap-3">
              <TrendingUp className="size-4 shrink-0 text-emerald-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium">{item.title}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {item.detail}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AnimateOnView>
  );
}

// ── Section 7: Profile Optimizations ───────────────────────────────

function ProfileOptimizations() {
  const data = useAdviceData();
  return (
    <AnimateOnView delay={0.3} className="h-full">
      <div className="rounded-lg border border-border bg-card p-5 h-full">
        <SectionHeader title="Profile Optimizations" />
        <div className="space-y-3">
          {data.profileOptimizations.map((opt, i) => (
            <div
              key={i}
              className="rounded-md border border-border bg-background p-3 space-y-2"
            >
              <div className="flex items-center gap-2">
                <Target className="size-3.5 shrink-0 text-emerald-400" />
                <span className="font-mono text-xs font-bold">{opt.area}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Current
                  </span>
                  <p className="mt-0.5 text-muted-foreground">{opt.current}</p>
                </div>
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-400">
                    Suggestion
                  </span>
                  <p className="mt-0.5">{opt.suggestion}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AnimateOnView>
  );
}

// ── Section 8: 30-60-90 Day Action Plan ────────────────────────────

function ActionPlan() {
  const data = useAdviceData();

  const timeframeStyle = {
    "30 days": { color: "text-emerald-400", border: "border-emerald-400/30", bg: "bg-emerald-500/10" },
    "60 days": { color: "text-yellow-400", border: "border-yellow-400/30", bg: "bg-yellow-500/10" },
    "90 days": { color: "text-purple-400", border: "border-purple-400/30", bg: "bg-purple-500/10" },
  };

  return (
    <AnimateOnView delay={0.36}>
      <div className="rounded-lg border border-border bg-card p-5">
        <SectionHeader
          title="Action Plan"
          subtitle="Your 30-60-90 day roadmap"
        />
        <div className="grid gap-3 lg:grid-cols-3">
          {data.actionPlan.map((phase) => {
            const style = timeframeStyle[phase.timeframe];
            return (
              <div
                key={phase.timeframe}
                className={`rounded-md border ${style.border} ${style.bg} p-4 space-y-3`}
              >
                <div className="flex items-center gap-2">
                  <Calendar className={`size-4 ${style.color}`} />
                  <h3 className={`font-mono text-sm font-bold ${style.color}`}>
                    {phase.timeframe}
                  </h3>
                </div>
                <div className="space-y-2">
                  {phase.actions.map((action, i) => (
                    <div key={i} className="flex gap-2">
                      <ArrowUpRight className={`size-3 shrink-0 mt-0.5 ${style.color}`} />
                      <p className="text-xs leading-relaxed">{action}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AnimateOnView>
  );
}

// ── Section 9: Sticky Export Bar ──────────────────────────────────

interface AdviceExportBarProps {
  username: string;
  adviceRef: React.RefObject<HTMLDivElement | null>;
  onBeforeExport: () => void;
  onAfterExport: () => void;
}

function AdviceExportBar({ username, adviceRef, onBeforeExport, onAfterExport }: AdviceExportBarProps) {
  const router = useRouter();
  const [isExporting, setIsExporting] = useState(false);

  const handleExportPDF = async () => {
    if (!adviceRef.current || isExporting) return;

    setIsExporting(true);
    onBeforeExport();

    try {
      await new Promise((r) => setTimeout(r, 300));

      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas-pro"),
        import("jspdf"),
      ]);

      const element = adviceRef.current;

      const bgColor =
        getComputedStyle(document.documentElement).getPropertyValue("--background").trim();
      const resolvedBg = bgColor || "#0A0A0B";

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: resolvedBg,
        onclone: (doc, clonedEl) => {
          const sheets = doc.querySelectorAll('style, link[rel="stylesheet"]');
          sheets.forEach((sheet) => {
            if (sheet instanceof HTMLStyleElement && sheet.textContent) {
              sheet.textContent = sheet.textContent.replace(
                /[^;{}]*(?:conic|linear|radial)-gradient\([^)]*(?:in\s+(?:oklch|oklab|srgb|display-p3|hsl|lab|lch)[^)]*)\)[^;{}]*/gi,
                "",
              );
            }
          });

          const animated = clonedEl.querySelectorAll("*");
          animated.forEach((el) => {
            const htmlEl = el as HTMLElement;
            const computed = getComputedStyle(htmlEl);
            if (computed.backgroundImage && computed.backgroundImage !== "none") {
              htmlEl.style.backgroundImage = "none";
            }
            htmlEl.style.opacity = "1";
            htmlEl.style.transform = "none";
          });
          const svgAnimated = clonedEl.querySelectorAll("circle, path");
          svgAnimated.forEach((el) => {
            el.removeAttribute("style");
            (el as HTMLElement).style.opacity = "1";
          });
        },
      });

      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = 210;
      const pdfHeight = 297;

      const pageCanvasHeight = Math.floor(
        canvas.height * (pdfHeight / ((canvas.height * pdfWidth) / canvas.width))
      );
      const totalPages = Math.ceil(canvas.height / pageCanvasHeight);

      for (let page = 0; page < totalPages; page++) {
        const sliceY = page * pageCanvasHeight;
        const sliceH = Math.min(pageCanvasHeight, canvas.height - sliceY);

        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvas.width;
        pageCanvas.height = pageCanvasHeight;
        const ctx = pageCanvas.getContext("2d")!;

        ctx.fillStyle = resolvedBg;
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);

        ctx.drawImage(
          canvas,
          0, sliceY, canvas.width, sliceH,
          0, 0, canvas.width, sliceH,
        );

        const pageData = pageCanvas.toDataURL("image/png");
        if (page > 0) pdf.addPage();
        pdf.addImage(pageData, "PNG", 0, 0, pdfWidth, pdfHeight);
      }

      const date = new Date().toISOString().split("T")[0];
      pdf.save(`repofy-advice-${username}-${date}.pdf`);
    } catch (err) {
      console.error("PDF export failed:", err);
    } finally {
      onAfterExport();
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 lg:left-48 z-50 border-t border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <p className="hidden font-mono text-xs text-muted-foreground sm:block">
          Advice for{" "}
          <span className="text-emerald-400">@{username}</span>
        </p>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            size="sm"
            variant="outline"
            className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-400 font-mono text-xs flex-1 sm:flex-initial"
            onClick={() => router.push(`/advisor/generate/${username}`)}
          >
            <RefreshCw className="size-3.5" />
            Run Again
          </Button>
          <Button
            size="sm"
            className="bg-emerald-500 text-background hover:bg-emerald-500/90 font-mono text-xs flex-1 sm:flex-initial"
            onClick={handleExportPDF}
            disabled={isExporting}
          >
            {isExporting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <FileDown className="size-3.5" />
            )}
            {isExporting ? "Exporting..." : "Export PDF"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main Advice Report Component ───────────────────────────────────

interface AdviceReportProps {
  username: string;
  avatarUrl?: string;
  data: AdviceData;
}

export function AdviceReport({ username, avatarUrl, data }: AdviceReportProps) {
  const adviceRef = useRef<HTMLDivElement>(null);
  const [pdfMode, setPdfMode] = useState(false);

  return (
    <AdviceDataContext.Provider value={data}>
      <div className="space-y-4 pb-20">
        <div ref={adviceRef} data-pdf-target className="space-y-4">
          <TopBanner username={username} avatarUrl={avatarUrl} />
          <Summary />
          <ProjectIdeas />
          <RepoImprovements expandAll={pdfMode} />
          <SkillsToLearn />
          <div className="grid gap-4 lg:grid-cols-2 items-stretch">
            <ContributionAdvice />
            <ProfileOptimizations />
          </div>
          <ActionPlan />
        </div>
        <AdviceExportBar
          username={username}
          adviceRef={adviceRef}
          onBeforeExport={() => setPdfMode(true)}
          onAfterExport={() => setPdfMode(false)}
        />
      </div>
    </AdviceDataContext.Provider>
  );
}

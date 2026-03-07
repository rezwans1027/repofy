/**
 * Clean, document-style PDF layout for the analysis report.
 * Designed for paper — no cards, badges, or web UI chrome.
 */
import type { ReportData } from "./analysis-report";

interface PdfLayoutProps {
  username: string;
  data: ReportData;
}

function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/^[-*]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .trim();
}

function Divider() {
  return <div className="border-b border-foreground/10" />;
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-3">
      {children}
    </h2>
  );
}

export function AnalysisReportPdfLayout({ username, data }: PdfLayoutProps) {
  const paragraphs = stripMarkdown(data.narrativeReport)
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\n/g, " ").trim())
    .filter((p) => p.length > 0);

  return (
    <div
      data-pdf-sections
      className="font-sans text-foreground"
      style={{ fontSize: "13px", lineHeight: "1.65" }}
    >
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="pb-5 mb-5 border-b-2 border-foreground/15">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[22px] font-bold tracking-tight leading-tight">
              Developer Report
            </h1>
            <p className="text-[15px] text-muted-foreground mt-1">@{username}</p>
            <p className="text-[13px] text-muted-foreground">
              {data.candidateLevel} · {data.recommendation}
            </p>
          </div>
          <div className="text-right">
            <div className="text-[36px] font-bold leading-none tabular-nums">
              {data.overallScore}
            </div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] mt-1">
              Overall Score
            </div>
          </div>
        </div>
      </div>

      {/* ── Executive Summary ──────────────────────────────── */}
      <div className="mb-5">
        <Heading>Executive Summary</Heading>
        <div className="space-y-2">
          {paragraphs.map((p, i) => (
            <p key={i} className="text-muted-foreground">
              {p}
            </p>
          ))}
        </div>
      </div>

      <Divider />

      {/* ── Skills Assessment ──────────────────────────────── */}
      <div className="py-5">
        <Heading>Skills Assessment</Heading>
        <div className="space-y-3">
          {data.radarBreakdown.map((item) => (
            <div key={item.label}>
              <div className="flex items-baseline justify-between mb-1">
                <span className="font-medium text-[13px]">{item.label}</span>
                <span className="text-[13px] font-semibold tabular-nums">
                  {item.score}/10
                </span>
              </div>
              <div className="h-[3px] w-full bg-foreground/8 rounded-full">
                <div
                  className="h-[3px] bg-foreground/30 rounded-full"
                  style={{ width: `${item.score * 10}%` }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {item.note}
              </p>
            </div>
          ))}
        </div>
      </div>

      <Divider />

      {/* ── Key Statistics ─────────────────────────────────── */}
      <div className="py-5">
        <Heading>Key Statistics</Heading>
        <div className="grid grid-cols-3 gap-x-8 gap-y-1.5">
          {(
            [
              ["Repositories", data.stats.repos],
              ["Stars", data.stats.stars.toLocaleString()],
              ["Followers", data.stats.followers],
              ["Contributions", data.stats.contributions.toLocaleString()],
              ["Stars / Repo", data.stats.starsPerRepo.toFixed(1)],
              [
                "Collaboration",
                `${Math.round(data.stats.collaborationRatio * 100)}%`,
              ],
            ] as [string, string | number][]
          ).map(([label, value]) => (
            <div
              key={label}
              className="flex justify-between items-baseline border-b border-foreground/5 pb-1"
            >
              <span className="text-[11px] text-muted-foreground">{label}</span>
              <span className="font-semibold text-[13px] tabular-nums">
                {value}
              </span>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground mt-3 italic">
          {data.stats.interpretation}
        </p>
      </div>

      <Divider />

      {/* ── Activity Breakdown ─────────────────────────────── */}
      <div className="py-5">
        <Heading>Activity Breakdown</Heading>
        <div className="flex gap-8">
          {(
            [
              ["Pushes", data.activityBreakdown.push],
              ["Pull Requests", data.activityBreakdown.pr],
              ["Issues", data.activityBreakdown.issue],
              ["Reviews", data.activityBreakdown.review],
            ] as [string, number][]
          ).map(([label, val]) => (
            <div key={label}>
              <span className="font-semibold text-[14px] tabular-nums">
                {val}%
              </span>
              <span className="text-[11px] text-muted-foreground ml-1.5">
                {label}
              </span>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground mt-3 italic">
          {data.activityBreakdown.interpretation}
        </p>
      </div>

      <Divider />

      {/* ── Language Profile ────────────────────────────────── */}
      <div className="py-5">
        <Heading>Language Profile</Heading>
        <div className="space-y-1">
          {data.languageProfile.languages.map((lang) => (
            <div
              key={lang.name}
              className="flex items-center justify-between py-0.5 border-b border-foreground/5"
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: lang.color }}
                />
                <span className="text-[13px] font-medium">{lang.name}</span>
              </div>
              <div className="flex items-center gap-6 text-[11px] text-muted-foreground tabular-nums">
                <span>{lang.percentage}%</span>
                <span>{lang.repos} repos</span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground mt-3 italic">
          {data.languageProfile.interpretation}
        </p>
      </div>

      <Divider />

      {/* ── Top Repositories ───────────────────────────────── */}
      <div className="py-5">
        <Heading>Top Repositories</Heading>
        <div className="space-y-4">
          {data.topRepos.map((repo) => (
            <div key={repo.name} className="border-b border-foreground/5 pb-3">
              <div className="flex items-baseline justify-between">
                <span className="font-semibold text-[13px]">
                  {repo.name}
                  {repo.isBestWork && (
                    <span className="text-[10px] text-muted-foreground font-normal ml-2">
                      Best Work
                    </span>
                  )}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {repo.language} · {repo.stars} stars · {repo.forks} forks
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {repo.description}
              </p>
              <div className="flex gap-5 mt-1.5 text-[11px]">
                <span>
                  Code Quality:{" "}
                  <span className="font-medium">{repo.codeQuality}</span>
                </span>
                <span>
                  Testing:{" "}
                  <span className="font-medium">{repo.testing}</span>
                </span>
                <span>
                  CI/CD: <span className="font-medium">{repo.cicd}</span>
                </span>
                <span>
                  Verdict:{" "}
                  <span className="font-medium">{repo.verdict}</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Divider />

      {/* ── Strengths & Weaknesses ─────────────────────────── */}
      <div className="py-5 grid grid-cols-2 gap-8">
        <div>
          <Heading>Strengths</Heading>
          <ul className="space-y-2.5">
            {data.strengths.map((s, i) => (
              <li key={i}>
                <p className="text-[12px] font-medium leading-snug">
                  {s.text}
                </p>
                <p className="text-[11px] text-muted-foreground italic mt-0.5">
                  {s.evidence}
                </p>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <Heading>Weaknesses</Heading>
          <ul className="space-y-2.5">
            {data.weaknesses.map((w, i) => (
              <li key={i}>
                <p className="text-[12px] font-medium leading-snug">
                  {w.text}
                </p>
                <p className="text-[11px] text-muted-foreground italic mt-0.5">
                  {w.evidence}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <Divider />

      {/* ── Red Flags ──────────────────────────────────────── */}
      <div className="py-5">
        <Heading>Red Flags ({data.redFlags.length})</Heading>
        {data.redFlags.length === 0 ? (
          <p className="text-[12px] text-muted-foreground">
            No red flags identified.
          </p>
        ) : (
          <div className="space-y-2.5">
            {data.redFlags.map((flag, i) => (
              <div key={i}>
                <p className="text-[12px]">
                  <span className="text-[10px] text-muted-foreground uppercase font-medium mr-1.5">
                    [{flag.severity}]
                  </span>
                  {flag.text}
                </p>
                <p className="text-[11px] text-muted-foreground italic mt-0.5">
                  {flag.explanation}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <Divider />

      {/* ── Interview Questions ─────────────────────────────── */}
      <div className="py-5">
        <Heading>Suggested Interview Questions</Heading>
        <div className="space-y-3">
          {data.interviewQuestions.map((q, i) => (
            <div key={i} className="flex gap-3">
              <span className="text-[11px] text-muted-foreground font-medium shrink-0 tabular-nums mt-px">
                {i + 1}.
              </span>
              <div>
                <p className="text-[12px] font-medium leading-snug">
                  {q.question}
                </p>
                <p className="text-[11px] text-muted-foreground italic mt-0.5">
                  {q.why}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Footer metadata ────────────────────────────────── */}
      <div className="pt-4 border-t border-foreground/10 flex justify-between text-[10px] text-muted-foreground">
        <span>Confidence: {Math.round(data.confidenceScore * 100)}%</span>
        <span>
          Rubric {data.rubricVersion} · Model {data.modelVersion}
        </span>
      </div>
    </div>
  );
}

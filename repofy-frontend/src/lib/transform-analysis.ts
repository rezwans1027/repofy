import { reportData as demoReportData } from "@/lib/demo-data";

type ReportDataSchema = typeof demoReportData;

const LANGUAGE_COLORS: Record<string, string> = {
  JavaScript: "#f1e05a",
  TypeScript: "#3178c6",
  Python: "#3572A5",
  Java: "#b07219",
  Go: "#00ADD8",
  Rust: "#dea584",
  "C++": "#f34b7d",
  C: "#555555",
  "C#": "#178600",
  Ruby: "#701516",
  PHP: "#4F5D95",
  Swift: "#F05138",
  Kotlin: "#A97BFF",
  Shell: "#89e051",
  HTML: "#e34c26",
  CSS: "#563d7c",
  Vue: "#41b883",
  Svelte: "#ff3e00",
  Other: "#71717A",
};

function gradeToLetter(grade: string): "A" | "A-" | "B+" | "B" | "B-" | "C+" | "C" | "C-" {
  const map: Record<string, "A" | "A-" | "B+" | "B" | "B-" | "C+" | "C" | "C-"> = {
    Excellent: "A",
    Good: "B+",
    Fair: "C+",
    Poor: "C-",
  };
  return (map[grade] ?? "B") as "A" | "A-" | "B+" | "B" | "B-" | "C+" | "C" | "C-";
}

function testingStatusToGrade(status: string): "A" | "B+" | "B" | "C+" | "C" {
  const map: Record<string, "A" | "B+" | "B" | "C+" | "C"> = {
    Strong: "A",
    Minimal: "C+",
    None: "C",
  };
  return (map[status] ?? "B") as "A" | "B+" | "B" | "C+" | "C";
}

function cicdStatusToGrade(status: string): "A" | "A-" | "B" | "C" {
  const map: Record<string, "A" | "A-" | "B" | "C"> = {
    "Pipeline Configured": "A",
    Partial: "B",
    None: "C",
  };
  return (map[status] ?? "B") as "A" | "A-" | "B" | "C";
}

export interface AnalyzeApiResponse {
  contributions?: { totalContributions: number } | null;
  profile: {
    username: string;
    name: string | null;
    avatarUrl: string;
    bio: string | null;
    company: string | null;
    location: string | null;
    followers: number;
    following: number;
    publicRepos: number;
    createdAt: string;
  };
  repositories: Array<{
    name: string;
    fullName: string;
    description: string | null;
    language: string | null;
    stars: number;
    forks: number;
    topics: string[];
    url: string;
  }>;
  stats: {
    totalStars: number;
    totalForks: number;
    originalRepos: number;
    accountAgeDays: number;
  };
  activity: {
    totalEvents: number;
    pushEvents: number;
    prEvents: number;
    issueEvents: number;
    reviewEvents: number;
  };
  languages: Array<{
    name: string;
    color: string;
    percentage: number;
    repoCount: number;
  }>;
  analysis: {
    candidate_level: string;
    hiring_recommendation: string;
    career_capital_score: number;
    summary_narrative: string;
    radar_chart: {
      code_quality: number;
      project_complexity: number;
      technical_breadth: number;
      engineering_practices: number;
      consistency_activity: number;
      collaboration_docs: number;
    };
    top_repos_analysis: Array<{
      name: string;
      description: string;
      tech_stack: string[];
      code_quality_grade: string;
      testing_status: string;
      ci_cd_status: string;
      ai_verdict: string;
    }>;
    key_strengths: string[];
    weaknesses: string[];
    red_flags: Array<{ flag: string; severity: string }>;
    suggested_interview_questions: Array<{
      question: string;
      context: string;
    }>;
  };
}

export type ReportData = typeof ReportDataSchema;

export interface TransformResult {
  reportData: ReportData;
  profileName: string | null;
}

export function transformAnalysisToReportData(
  apiResponse: AnalyzeApiResponse
): TransformResult {
  const { profile, stats, activity, languages, analysis } = apiResponse;
  const rc = analysis.radar_chart;

  const radarLabels = [
    "Code Quality",
    "Project Complexity",
    "Technical Breadth",
    "Eng. Practices",
    "Consistency",
    "Collaboration",
  ] as const;
  const radarKeys = [
    "code_quality",
    "project_complexity",
    "technical_breadth",
    "engineering_practices",
    "consistency_activity",
    "collaboration_docs",
  ] as const;

  const radarAxes = radarLabels.map((label, i) => ({
    axis: label,
    value: (rc[radarKeys[i]] ?? 50) / 100,
  }));

  const radarBreakdown = radarLabels.map((label, i) => {
    const score = (rc[radarKeys[i]] ?? 50) / 10;
    return {
      label,
      score,
      note: `${label} assessment from AI analysis`,
    };
  });

  const totalEvents = activity.totalEvents || 1;
  const pushPct = Math.round((activity.pushEvents / totalEvents) * 100);
  const prPct = Math.round((activity.prEvents / totalEvents) * 100);
  const issuePct = Math.round((activity.issueEvents / totalEvents) * 100);
  const reviewPct = Math.round((activity.reviewEvents / totalEvents) * 100);

  const totalStars = stats.totalStars;
  const repos = stats.originalRepos || profile.publicRepos || 1;
  const starsPerRepo = totalStars / repos;
  const collaborationRatio =
    totalEvents > 0
      ? (activity.prEvents + activity.reviewEvents) / totalEvents
      : 0;

  const topRepos = analysis.top_repos_analysis.map((r, i) => {
    const repo = apiResponse.repositories.find((rep) => rep.name === r.name);
    return {
      name: r.name,
      description: r.description || repo?.description || "",
      language: r.tech_stack[0] || repo?.language || "Unknown",
      languageColor:
        LANGUAGE_COLORS[r.tech_stack[0]] ||
        LANGUAGE_COLORS[repo?.language ?? ""] ||
        "#71717A",
      stars: repo?.stars ?? 0,
      forks: repo?.forks ?? 0,
      topics: r.tech_stack.length ? r.tech_stack : repo?.topics ?? [],
      codeQuality: gradeToLetter(r.code_quality_grade),
      testing: testingStatusToGrade(r.testing_status),
      cicd: cicdStatusToGrade(r.ci_cd_status),
      verdict: r.ai_verdict,
      isBestWork: i === 0,
    };
  });

  const reportData: ReportData = {
    candidateLevel: analysis.candidate_level as ReportData["candidateLevel"],
    overallScore: analysis.career_capital_score,
    recommendation: analysis.hiring_recommendation as ReportData["recommendation"],
    summary: analysis.summary_narrative,
    radarAxes,
    radarBreakdown,
    stats: {
      repos: profile.publicRepos,
      stars: totalStars,
      followers: profile.followers,
      contributions:
        apiResponse.contributions?.totalContributions ??
        Math.round(totalStars * 2 + profile.followers),
      starsPerRepo,
      collaborationRatio,
      interpretation: analysis.summary_narrative.slice(0, 200) + "...",
    },
    activityBreakdown: {
      push: pushPct,
      pr: prPct,
      issue: issuePct,
      review: reviewPct,
      interpretation: `Push ${pushPct}%, PR ${prPct}%, Issue ${issuePct}%, Review ${reviewPct}%.`,
    },
    languageProfile: {
      languages: languages.map((l) => ({
        name: l.name,
        color: l.color,
        percentage: l.percentage,
        repos: l.repoCount,
      })),
      interpretation: `Primary languages from repository analysis.`,
    },
    topRepos,
    strengths: analysis.key_strengths.map((text) => ({
      text,
      evidence: "AI analysis of GitHub profile",
    })),
    weaknesses: analysis.weaknesses.map((text) => ({
      text,
      evidence: "AI analysis of GitHub profile",
    })),
    redFlags: analysis.red_flags.map((rf) => ({
      text: rf.flag,
      severity: rf.severity as "Minor" | "Notable" | "Critical",
      explanation: rf.flag,
    })),
    interviewQuestions: analysis.suggested_interview_questions.map((q) => ({
      question: q.question,
      why: q.context,
    })),
  };

  return {
    reportData,
    profileName: profile.name ?? null,
  };
}

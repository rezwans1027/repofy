import type { ScorerResponse, ScoringResult, GitHubUserData, AxisLabel } from "../types";
import { LANGUAGE_COLORS, DEFAULT_COLOR } from "../lib/language-colors";

/**
 * Merge Scorer AI response, backend-computed scoring, and narrative report
 * with GitHub data to produce the full report the frontend expects.
 */
export function buildReportData(
  scorer: ScorerResponse,
  scoring: ScoringResult,
  narrativeReport: string,
  github: GitHubUserData,
) {
  const { profile, topRepositories, languages, activity, stats, contributions } = github;

  // Activity percentages from raw event counts (largest-remainder method)
  const totalEvents = activity.totalEvents;
  let pushPct = 0, prPct = 0, issuePct = 0, reviewPct = 0;
  if (totalEvents > 0) {
    const raw = [
      { key: "push", exact: (activity.pushEvents / totalEvents) * 100 },
      { key: "pr", exact: (activity.prEvents / totalEvents) * 100 },
      { key: "issue", exact: (activity.issueEvents / totalEvents) * 100 },
      { key: "review", exact: (activity.reviewEvents / totalEvents) * 100 },
    ];
    const floored = raw.map((r) => ({ ...r, floor: Math.floor(r.exact) }));
    let remainder = 100 - floored.reduce((s, r) => s + r.floor, 0);
    floored
      .sort((a, b) => (b.exact - b.floor) - (a.exact - a.floor))
      .forEach((r) => { if (remainder > 0) { r.floor++; remainder--; } });
    for (const r of floored) {
      if (r.key === "push") pushPct = r.floor;
      else if (r.key === "pr") prPct = r.floor;
      else if (r.key === "issue") issuePct = r.floor;
      else reviewPct = r.floor;
    }
  }

  // Computed ratios
  const starsPerRepo =
    profile.publicRepos > 0
      ? Math.round((stats.totalStars / profile.publicRepos) * 10) / 10
      : 0;
  const collaborationRatio =
    totalEvents > 0
      ? Math.round(
          ((activity.prEvents + activity.reviewEvents) / totalEvents) * 100,
        ) / 100
      : 0;

  // Match AI topRepos with actual GitHub repo data
  const topRepos = scorer.topRepos.map((aiRepo) => {
    const ghRepo = topRepositories.find(
      (r) => r.name.toLowerCase() === aiRepo.name.toLowerCase(),
    );
    return {
      name: aiRepo.name,
      description: ghRepo?.description || null,
      language: ghRepo?.language || null,
      languageColor: ghRepo?.language
        ? LANGUAGE_COLORS[ghRepo.language] || DEFAULT_COLOR
        : DEFAULT_COLOR,
      stars: ghRepo?.stars ?? 0,
      forks: ghRepo?.forks ?? 0,
      topics: ghRepo?.topics ?? [],
      codeQuality: aiRepo.codeQuality,
      testing: aiRepo.testing,
      cicd: aiRepo.cicd,
      verdict: aiRepo.verdict,
      isBestWork: aiRepo.isBestWork,
    };
  });

  // Language profile with colors from our map
  const languageProfile = {
    languages: languages.slice(0, 6).map((l) => ({
      name: l.name,
      color: l.color,
      percentage: l.percentage,
      repos: l.repoCount,
    })),
    interpretation: scorer.languageInterpretation,
  };

  // Merge radar breakdown: Scorer notes + ScoringResult scores
  const radarBreakdown = scorer.radarBreakdown.map((b) => ({
    label: b.label,
    score: scoring.radarBreakdownScores[b.label as AxisLabel] ?? 0,
    note: b.note,
  }));

  return {
    candidateLevel: scoring.candidateLevel,
    overallScore: scoring.overallScore,
    recommendation: scoring.recommendation,
    narrativeReport,

    radarAxes: scorer.radarAxes,
    radarBreakdown,

    stats: {
      repos: profile.publicRepos,
      stars: stats.totalStars,
      followers: profile.followers,
      contributions: contributions?.totalContributions ?? 0,
      starsPerRepo,
      collaborationRatio,
      interpretation: scorer.statsInterpretation,
    },

    activityBreakdown: {
      push: pushPct,
      pr: prPct,
      issue: issuePct,
      review: reviewPct,
      interpretation: scorer.activityInterpretation,
    },

    languageProfile,
    topRepos,
    strengths: scorer.strengths,
    weaknesses: scorer.weaknesses,
    redFlags: scorer.redFlags,
    interviewQuestions: scorer.interviewQuestions,

    // New metadata fields
    riskSignals: scoring.riskSignals,
    confidenceScore: scoring.confidenceScore,
    rubricVersion: scoring.rubricVersion,
    modelVersion: scoring.modelVersion,
    dataQualityWarnings: scorer.dataQualityWarnings,
  };
}

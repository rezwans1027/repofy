import type { ScorerResponse, ScoringResult, GitHubUserData, AxisLabel } from "../types";
import { LANGUAGE_COLORS, DEFAULT_COLOR } from "./github.service";

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

  // Activity percentages from raw event counts
  const totalEvents = activity.totalEvents;
  let pushPct = 0, prPct = 0, issuePct = 0, reviewPct = 0;
  if (totalEvents > 0) {
    pushPct = Math.round((activity.pushEvents / totalEvents) * 100);
    prPct = Math.round((activity.prEvents / totalEvents) * 100);
    issuePct = Math.round((activity.issueEvents / totalEvents) * 100);
    reviewPct = Math.max(100 - pushPct - prPct - issuePct, 0); // remainder to avoid > 100
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
      review: Math.max(reviewPct, 0),
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

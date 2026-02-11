import type { AIAnalysisResponse, GitHubUserData } from "../types";
import { LANGUAGE_COLORS, DEFAULT_COLOR } from "./github.service";

/**
 * Merge AI analysis with computed GitHub data to produce the full report
 * that the frontend expects (matching the ReportData shape from demo-data.ts).
 */
export function buildReportData(ai: AIAnalysisResponse, github: GitHubUserData) {
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
  const topRepos = ai.topRepos.map((aiRepo) => {
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
    interpretation: ai.languageInterpretation,
  };

  return {
    candidateLevel: ai.candidateLevel,
    overallScore: ai.overallScore,
    recommendation: ai.recommendation,
    summary: ai.summary,

    radarAxes: ai.radarAxes,
    radarBreakdown: ai.radarBreakdown,

    stats: {
      repos: profile.publicRepos,
      stars: stats.totalStars,
      followers: profile.followers,
      contributions: contributions?.totalContributions ?? 0,
      starsPerRepo,
      collaborationRatio,
      interpretation: ai.statsInterpretation,
    },

    activityBreakdown: {
      push: pushPct,
      pr: prPct,
      issue: issuePct,
      review: Math.max(reviewPct, 0),
      interpretation: ai.activityInterpretation,
    },

    languageProfile,
    topRepos,
    strengths: ai.strengths,
    weaknesses: ai.weaknesses,
    redFlags: ai.redFlags,
    interviewQuestions: ai.interviewQuestions,
  };
}

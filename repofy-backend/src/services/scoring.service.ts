import { env } from "../config/env";
import type {
  ScorerResponse,
  ScoringResult,
  AggregateMetrics,
  RepoSnapshot,
  AxisLabel,
  CandidateLevel,
  Recommendation,
} from "../types";

export const RUBRIC_VERSION = "v1.1";

const AXIS_WEIGHTS: Record<AxisLabel, number> = {
  "Code Quality": 0.25,
  "Eng. Practices": 0.20,
  "Project Complexity": 0.25,
  Consistency: 0.15,
  "Technical Breadth": 0.10,
  Collaboration: 0.05,
};

const RECOMMENDATION_ORDER: Recommendation[] = [
  "No Hire",
  "Weak Hire",
  "Hire",
  "Strong Hire",
];

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function dropRecommendation(current: Recommendation): Recommendation {
  const idx = RECOMMENDATION_ORDER.indexOf(current);
  return RECOMMENDATION_ORDER[Math.max(0, idx - 1)];
}

const LEVEL_THRESHOLDS = { staff: 85, senior: 75, midLevel: 60 } as const;
const RECOMMENDATION_THRESHOLDS = { strongHire: 80, hire: 65, weakHire: 50 } as const;
const RUBRIC = {
  engPractices: { noTestsNoBuildCap: 0.4, noTestsWithBuildCap: 0.6, noCICap: 0.6 },
  codeQuality: { noLintPenalty: 0.1 },
  consistency: { inactiveDaysThreshold: 365, inactiveCap: 0.3 },
  collaboration: {
    soloCap: 0.3,
    largeProjectFloor: 0.7,
    mediumProjectFloor: 0.5,
    largeProjectMinContributors: 500,
    mediumProjectMinContributors: 50,
  },
  globalFloor: 0.05,
} as const;

function levelFromScore(score: number): CandidateLevel {
  if (score >= LEVEL_THRESHOLDS.staff) return "Staff";
  if (score >= LEVEL_THRESHOLDS.senior) return "Senior";
  if (score >= LEVEL_THRESHOLDS.midLevel) return "Mid-Level";
  return "Junior";
}

function recommendationFromScore(score: number): Recommendation {
  if (score >= RECOMMENDATION_THRESHOLDS.strongHire) return "Strong Hire";
  if (score >= RECOMMENDATION_THRESHOLDS.hire) return "Hire";
  if (score >= RECOMMENDATION_THRESHOLDS.weakHire) return "Weak Hire";
  return "No Hire";
}

/** Apply deterministic rubric caps/floors from repo snapshot evidence. */
function applyRubricCaps(
  axisValues: Map<AxisLabel, number>,
  aggregateMetrics: AggregateMetrics,
  repoSnapshots: RepoSnapshot[],
): void {
  const allNoTests = repoSnapshots.length > 0 && repoSnapshots.every((s) => !s.hasTests);
  const allNoBuild = repoSnapshots.length > 0 && repoSnapshots.every((s) => !s.hasBuildSystem);
  const allNoCI = repoSnapshots.length > 0 && repoSnapshots.every((s) => !s.hasCI);
  const allNoLint = repoSnapshots.length > 0 && repoSnapshots.every((s) => !s.hasLintConfig);
  const allSoloNoPR = repoSnapshots.length > 0 &&
    repoSnapshots.every((s) => s.contributorCount <= 1) &&
    repoSnapshots.every((s) => s.pullRequestsCount === 0);
  const maxContributors = repoSnapshots.reduce((max, s) => Math.max(max, s.contributorCount), 0);

  // Eng. Practices caps
  if (allNoTests && allNoBuild) {
    capAxis(axisValues, "Eng. Practices", RUBRIC.engPractices.noTestsNoBuildCap);
  } else if (allNoTests && !allNoBuild) {
    capAxis(axisValues, "Eng. Practices", RUBRIC.engPractices.noTestsWithBuildCap);
  }
  if (allNoCI) {
    capAxis(axisValues, "Eng. Practices", RUBRIC.engPractices.noCICap);
  }

  // Code Quality: lint penalty
  if (allNoLint) {
    const current = axisValues.get("Code Quality") ?? 0;
    axisValues.set("Code Quality", Math.round(clamp(current - RUBRIC.codeQuality.noLintPenalty, 0, 1) * 100) / 100);
  }

  // Consistency cap
  if (aggregateMetrics.medianLatestPushDaysAgo > RUBRIC.consistency.inactiveDaysThreshold) {
    capAxis(axisValues, "Consistency", RUBRIC.consistency.inactiveCap);
  }

  // Collaboration caps and floors
  if (allSoloNoPR) {
    capAxis(axisValues, "Collaboration", RUBRIC.collaboration.soloCap);
  }
  // Floors override caps when met
  if (maxContributors >= RUBRIC.collaboration.largeProjectMinContributors) {
    floorAxis(axisValues, "Collaboration", RUBRIC.collaboration.largeProjectFloor);
  } else if (maxContributors >= RUBRIC.collaboration.mediumProjectMinContributors) {
    floorAxis(axisValues, "Collaboration", RUBRIC.collaboration.mediumProjectFloor);
  }

  // Global floor: no axis below minimum
  for (const axis of axisValues.keys()) {
    const v = axisValues.get(axis)!;
    if (v < RUBRIC.globalFloor) {
      axisValues.set(axis, RUBRIC.globalFloor);
    }
  }
}

function capAxis(axisValues: Map<AxisLabel, number>, axis: AxisLabel, cap: number): void {
  const current = axisValues.get(axis) ?? 0;
  if (current > cap) {
    axisValues.set(axis, cap);
  }
}

function floorAxis(axisValues: Map<AxisLabel, number>, axis: AxisLabel, floor: number): void {
  const current = axisValues.get(axis) ?? 0;
  if (current < floor) {
    axisValues.set(axis, floor);
  }
}

export function computeScoring(
  scorer: ScorerResponse,
  aggregateMetrics: AggregateMetrics,
  repoSnapshots: RepoSnapshot[],
): ScoringResult {
  // 1. Build axis value map, clamp & round
  const axisValues = new Map<AxisLabel, number>();
  for (const a of scorer.radarAxes) {
    axisValues.set(a.axis, Math.round(clamp(a.value, 0, 1) * 100) / 100);
  }

  // 1b. Deterministic rubric caps/floors from repo snapshot evidence
  applyRubricCaps(axisValues, aggregateMetrics, repoSnapshots);

  // 1c. Write capped values back to a cloned radarAxes so we don't mutate the input
  scorer.radarAxes = scorer.radarAxes.map((a) => ({
    ...a,
    value: axisValues.get(a.axis) ?? a.value,
  }));

  // 2. Weighted raw score
  let raw = 0;
  for (const [axis, weight] of Object.entries(AXIS_WEIGHTS) as [AxisLabel, number][]) {
    raw += (axisValues.get(axis) ?? 0) * weight;
  }
  const overallScore = Math.round(raw * 100);

  // 3. Radar breakdown scores: round(axisValue * 10) per axis
  const radarBreakdownScores = {} as Record<AxisLabel, number>;
  for (const axis of Object.keys(AXIS_WEIGHTS) as AxisLabel[]) {
    radarBreakdownScores[axis] = Math.round((axisValues.get(axis) ?? 0) * 10);
  }

  // 4. Candidate level
  const candidateLevel = levelFromScore(overallScore);

  // 5. Base recommendation
  let recommendation = recommendationFromScore(overallScore);

  // 6. Red flag adjustments
  const concerningCount = scorer.redFlags.filter((f) => f.severity === "Concerning").length;
  const notableCount = scorer.redFlags.filter((f) => f.severity === "Notable").length;

  if (concerningCount >= 2) {
    // Cap at Weak Hire
    const idx = RECOMMENDATION_ORDER.indexOf(recommendation);
    const capIdx = RECOMMENDATION_ORDER.indexOf("Weak Hire");
    if (idx > capIdx) {
      recommendation = "Weak Hire";
    }
  } else if (concerningCount === 1) {
    recommendation = dropRecommendation(recommendation);
  }

  // 7. Data quality cap
  const validSnapshots = repoSnapshots.filter((s) => s.sourceFileCount > 0).length;
  if (!aggregateMetrics.hasCode || validSnapshots < 2) {
    const idx = RECOMMENDATION_ORDER.indexOf(recommendation);
    const capIdx = RECOMMENDATION_ORDER.indexOf("Weak Hire");
    if (idx > capIdx) {
      recommendation = "Weak Hire";
    }
  }

  // 8. Confidence score
  const snapshotRatio = repoSnapshots.length > 0 ? validSnapshots / repoSnapshots.length : 0;
  const CONFIDENCE_PENALTY_PER_WARNING = 0.05;
  const warningPenalty = scorer.dataQualityWarnings.length * CONFIDENCE_PENALTY_PER_WARNING;
  const confidenceScore = Math.round(clamp(snapshotRatio - warningPenalty, 0, 1) * 100) / 100;

  return {
    overallScore,
    candidateLevel,
    recommendation,
    radarBreakdownScores,
    riskSignals: { concerningCount, notableCount },
    confidenceScore,
    rubricVersion: RUBRIC_VERSION,
    modelVersion: env.openaiModel,
  };
}

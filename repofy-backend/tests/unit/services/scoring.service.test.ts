import { describe, it, expect } from "vitest";
import { computeScoring } from "../../../src/services/scoring.service";
import type { ScorerResponse, AggregateMetrics, RepoSnapshot } from "../../../src/types";

function makeScorer(overrides: Partial<ScorerResponse> = {}): ScorerResponse {
  return {
    radarAxes: [
      { axis: "Code Quality", value: 0.8 },
      { axis: "Project Complexity", value: 0.7 },
      { axis: "Technical Breadth", value: 0.6 },
      { axis: "Eng. Practices", value: 0.75 },
      { axis: "Consistency", value: 0.65 },
      { axis: "Collaboration", value: 0.5 },
    ],
    radarBreakdown: [],
    topRepos: [],
    strengths: [],
    weaknesses: [],
    redFlags: [],
    interviewQuestions: [],
    dataQualityWarnings: [],
    statsInterpretation: "",
    activityInterpretation: "",
    languageInterpretation: "",
    ...overrides,
  };
}

function makeMetrics(overrides: Partial<AggregateMetrics> = {}): AggregateMetrics {
  return { medianLatestPushDaysAgo: 30, hasCode: true, ...overrides };
}

function makeSnapshot(overrides: Partial<RepoSnapshot> = {}): RepoSnapshot {
  return {
    name: "repo",
    fileTree: "src/\nindex.ts",
    hasTests: true,
    hasCI: true,
    hasLintConfig: true,
    hasDockerfile: false,
    hasBuildSystem: false,
    readmeWordCount: 100,
    releaseCount: 0,
    latestReleaseDaysAgo: -1,
    contributorCount: 3,
    latestPushDaysAgo: 10,
    openIssuesCount: 2,
    pullRequestsCount: 5,
    sourceFileCount: 10,
    totalLOC: 500,
    maxFileLOC: 100,
    largestFilePath: "src/index.ts",
    srcDirPresent: true,
    hasReleaseDiscipline: false,
    ...overrides,
  };
}

/** Two valid snapshots — avoids the data quality cap (requires >=2 valid snapshots). */
function twoSnapshots(): RepoSnapshot[] {
  return [makeSnapshot({ name: "a" }), makeSnapshot({ name: "b" })];
}

describe("computeScoring", () => {
  describe("weighted score calculation", () => {
    it("computes overallScore from axis weights", () => {
      // CQ=0.8*0.25 + PC=0.7*0.25 + TB=0.6*0.10 + EP=0.75*0.20 + Con=0.65*0.15 + Col=0.5*0.05
      // = 0.20 + 0.175 + 0.06 + 0.15 + 0.0975 + 0.025 = 0.7075
      const result = computeScoring(makeScorer(), makeMetrics(), [makeSnapshot()]);
      expect(result.overallScore).toBe(71); // Math.round(0.7075 * 100)
    });

    it("clamps axis values to [0, 1] and applies 0.05 floor", () => {
      const scorer = makeScorer({
        radarAxes: [
          { axis: "Code Quality", value: 1.5 },
          { axis: "Project Complexity", value: -0.2 },
          { axis: "Technical Breadth", value: 0.6 },
          { axis: "Eng. Practices", value: 0.75 },
          { axis: "Consistency", value: 0.65 },
          { axis: "Collaboration", value: 0.5 },
        ],
      });
      const result = computeScoring(scorer, makeMetrics(), [makeSnapshot()]);
      // CQ clamped to 1.0, PC clamped to 0.0 then floored to 0.05
      // 1.0*0.25 + 0.05*0.25 + 0.6*0.10 + 0.75*0.20 + 0.65*0.15 + 0.5*0.05
      // = 0.25 + 0.0125 + 0.06 + 0.15 + 0.0975 + 0.025 = 0.595
      expect(result.overallScore).toBe(60);
    });

    it("handles all-zero axes (floored to 0.05 each)", () => {
      const scorer = makeScorer({
        radarAxes: [
          { axis: "Code Quality", value: 0 },
          { axis: "Project Complexity", value: 0 },
          { axis: "Technical Breadth", value: 0 },
          { axis: "Eng. Practices", value: 0 },
          { axis: "Consistency", value: 0 },
          { axis: "Collaboration", value: 0 },
        ],
      });
      const result = computeScoring(scorer, makeMetrics(), [makeSnapshot()]);
      // All axes floored to 0.05 → 0.05 * 1.0 = 0.05 → 5
      expect(result.overallScore).toBe(5);
    });

    it("handles all-max axes", () => {
      const scorer = makeScorer({
        radarAxes: [
          { axis: "Code Quality", value: 1 },
          { axis: "Project Complexity", value: 1 },
          { axis: "Technical Breadth", value: 1 },
          { axis: "Eng. Practices", value: 1 },
          { axis: "Consistency", value: 1 },
          { axis: "Collaboration", value: 1 },
        ],
      });
      const result = computeScoring(scorer, makeMetrics(), [makeSnapshot()]);
      expect(result.overallScore).toBe(100);
    });
  });

  describe("candidate level thresholds", () => {
    it("returns Staff for score >= 85", () => {
      const scorer = makeScorer({
        radarAxes: [
          { axis: "Code Quality", value: 0.9 },
          { axis: "Project Complexity", value: 0.9 },
          { axis: "Technical Breadth", value: 0.8 },
          { axis: "Eng. Practices", value: 0.85 },
          { axis: "Consistency", value: 0.8 },
          { axis: "Collaboration", value: 0.7 },
        ],
      });
      const result = computeScoring(scorer, makeMetrics(), [makeSnapshot()]);
      expect(result.overallScore).toBeGreaterThanOrEqual(85);
      expect(result.candidateLevel).toBe("Staff");
    });

    it("returns Senior for score 75-84", () => {
      const scorer = makeScorer({
        radarAxes: [
          { axis: "Code Quality", value: 0.85 },
          { axis: "Project Complexity", value: 0.75 },
          { axis: "Technical Breadth", value: 0.7 },
          { axis: "Eng. Practices", value: 0.8 },
          { axis: "Consistency", value: 0.7 },
          { axis: "Collaboration", value: 0.6 },
        ],
      });
      const result = computeScoring(scorer, makeMetrics(), [makeSnapshot()]);
      expect(result.overallScore).toBeGreaterThanOrEqual(75);
      expect(result.overallScore).toBeLessThan(85);
      expect(result.candidateLevel).toBe("Senior");
    });

    it("returns Mid-Level for score 60-74", () => {
      const result = computeScoring(makeScorer(), makeMetrics(), [makeSnapshot()]);
      expect(result.overallScore).toBeGreaterThanOrEqual(60);
      expect(result.overallScore).toBeLessThan(75);
      expect(result.candidateLevel).toBe("Mid-Level");
    });

    it("returns Junior for score < 60", () => {
      const scorer = makeScorer({
        radarAxes: [
          { axis: "Code Quality", value: 0.5 },
          { axis: "Project Complexity", value: 0.5 },
          { axis: "Technical Breadth", value: 0.5 },
          { axis: "Eng. Practices", value: 0.5 },
          { axis: "Consistency", value: 0.5 },
          { axis: "Collaboration", value: 0.5 },
        ],
      });
      const result = computeScoring(scorer, makeMetrics(), [makeSnapshot()]);
      expect(result.overallScore).toBeLessThan(60);
      expect(result.candidateLevel).toBe("Junior");
    });
  });

  describe("recommendation thresholds", () => {
    it("returns Strong Hire for score >= 80", () => {
      const scorer = makeScorer({
        radarAxes: [
          { axis: "Code Quality", value: 0.85 },
          { axis: "Project Complexity", value: 0.85 },
          { axis: "Technical Breadth", value: 0.75 },
          { axis: "Eng. Practices", value: 0.8 },
          { axis: "Consistency", value: 0.75 },
          { axis: "Collaboration", value: 0.7 },
        ],
      });
      const result = computeScoring(scorer, makeMetrics(), twoSnapshots());
      expect(result.overallScore).toBeGreaterThanOrEqual(80);
      expect(result.recommendation).toBe("Strong Hire");
    });

    it("returns Hire for score 65-79", () => {
      const result = computeScoring(makeScorer(), makeMetrics(), twoSnapshots());
      expect(result.overallScore).toBeGreaterThanOrEqual(65);
      expect(result.overallScore).toBeLessThan(80);
      expect(result.recommendation).toBe("Hire");
    });

    it("returns Weak Hire for score 50-64", () => {
      const scorer = makeScorer({
        radarAxes: [
          { axis: "Code Quality", value: 0.55 },
          { axis: "Project Complexity", value: 0.55 },
          { axis: "Technical Breadth", value: 0.55 },
          { axis: "Eng. Practices", value: 0.55 },
          { axis: "Consistency", value: 0.55 },
          { axis: "Collaboration", value: 0.55 },
        ],
      });
      const result = computeScoring(scorer, makeMetrics(), [makeSnapshot()]);
      expect(result.overallScore).toBeGreaterThanOrEqual(50);
      expect(result.overallScore).toBeLessThan(65);
      expect(result.recommendation).toBe("Weak Hire");
    });

    it("returns No Hire for score < 50", () => {
      const scorer = makeScorer({
        radarAxes: [
          { axis: "Code Quality", value: 0.4 },
          { axis: "Project Complexity", value: 0.4 },
          { axis: "Technical Breadth", value: 0.4 },
          { axis: "Eng. Practices", value: 0.4 },
          { axis: "Consistency", value: 0.4 },
          { axis: "Collaboration", value: 0.4 },
        ],
      });
      const result = computeScoring(scorer, makeMetrics(), [makeSnapshot()]);
      expect(result.overallScore).toBeLessThan(50);
      expect(result.recommendation).toBe("No Hire");
    });
  });

  describe("red flag adjustments", () => {
    it("drops recommendation by one tier for 1 Concerning flag", () => {
      const scorer = makeScorer({
        redFlags: [
          { text: "Secrets in code", severity: "Concerning", explanation: "Found API keys." },
        ],
      });
      // Base score 71 → base recommendation "Hire" → dropped to "Weak Hire"
      const result = computeScoring(scorer, makeMetrics(), [makeSnapshot()]);
      expect(result.recommendation).toBe("Weak Hire");
      expect(result.riskSignals.concerningCount).toBe(1);
    });

    it("caps at Weak Hire for 2+ Concerning flags", () => {
      const scorer = makeScorer({
        radarAxes: [
          { axis: "Code Quality", value: 0.9 },
          { axis: "Project Complexity", value: 0.9 },
          { axis: "Technical Breadth", value: 0.8 },
          { axis: "Eng. Practices", value: 0.85 },
          { axis: "Consistency", value: 0.8 },
          { axis: "Collaboration", value: 0.7 },
        ],
        redFlags: [
          { text: "Secrets", severity: "Concerning", explanation: "Found keys." },
          { text: "Malware", severity: "Concerning", explanation: "Suspicious code." },
        ],
      });
      const result = computeScoring(scorer, makeMetrics(), twoSnapshots());
      expect(result.overallScore).toBeGreaterThanOrEqual(80);
      expect(result.recommendation).toBe("Weak Hire");
      expect(result.riskSignals.concerningCount).toBe(2);
    });

    it("does not adjust recommendation for Notable flags only", () => {
      const scorer = makeScorer({
        redFlags: [
          { text: "No README", severity: "Notable", explanation: "Missing docs." },
          { text: "Stale repos", severity: "Notable", explanation: "Old code." },
        ],
      });
      const result = computeScoring(scorer, makeMetrics(), twoSnapshots());
      expect(result.recommendation).toBe("Hire"); // unchanged
      expect(result.riskSignals.notableCount).toBe(2);
    });

    it("does not drop below No Hire", () => {
      const scorer = makeScorer({
        radarAxes: [
          { axis: "Code Quality", value: 0.4 },
          { axis: "Project Complexity", value: 0.4 },
          { axis: "Technical Breadth", value: 0.4 },
          { axis: "Eng. Practices", value: 0.4 },
          { axis: "Consistency", value: 0.4 },
          { axis: "Collaboration", value: 0.4 },
        ],
        redFlags: [
          { text: "Secrets", severity: "Concerning", explanation: "Bad." },
        ],
      });
      const result = computeScoring(scorer, makeMetrics(), [makeSnapshot()]);
      expect(result.recommendation).toBe("No Hire");
    });
  });

  describe("data quality cap", () => {
    it("caps at Weak Hire when hasCode is false", () => {
      const scorer = makeScorer();
      const result = computeScoring(scorer, makeMetrics({ hasCode: false }), [makeSnapshot()]);
      expect(result.overallScore).toBeGreaterThanOrEqual(65);
      expect(result.recommendation).toBe("Weak Hire");
    });

    it("caps at Weak Hire when fewer than 2 valid snapshots", () => {
      const scorer = makeScorer();
      const result = computeScoring(scorer, makeMetrics(), [
        makeSnapshot({ sourceFileCount: 0 }),
      ]);
      expect(result.recommendation).toBe("Weak Hire");
    });

    it("does not cap when 2+ valid snapshots and hasCode", () => {
      const scorer = makeScorer();
      const result = computeScoring(scorer, makeMetrics(), [
        makeSnapshot({ name: "a" }),
        makeSnapshot({ name: "b" }),
      ]);
      expect(result.recommendation).toBe("Hire");
    });
  });

  describe("radar breakdown scores", () => {
    it("computes round(value * 10) for each axis", () => {
      const result = computeScoring(makeScorer(), makeMetrics(), [makeSnapshot()]);
      expect(result.radarBreakdownScores["Code Quality"]).toBe(8);
      expect(result.radarBreakdownScores["Project Complexity"]).toBe(7);
      expect(result.radarBreakdownScores["Technical Breadth"]).toBe(6);
      expect(result.radarBreakdownScores["Eng. Practices"]).toBe(8); // round(0.75*10) = 8
      expect(result.radarBreakdownScores["Consistency"]).toBe(7); // round(0.65*10) = 7
      expect(result.radarBreakdownScores["Collaboration"]).toBe(5);
    });
  });

  describe("confidence score", () => {
    it("returns 1.0 with all valid snapshots and no warnings", () => {
      const result = computeScoring(makeScorer(), makeMetrics(), [
        makeSnapshot({ name: "a" }),
        makeSnapshot({ name: "b" }),
      ]);
      expect(result.confidenceScore).toBe(1.0);
    });

    it("decreases with data quality warnings", () => {
      const scorer = makeScorer({
        dataQualityWarnings: ["Only 2 repos had data", "No snippets"],
      });
      const result = computeScoring(scorer, makeMetrics(), [makeSnapshot()]);
      // snapshotRatio = 1.0, warningPenalty = 2 * 0.05 = 0.1, confidence = 0.9
      expect(result.confidenceScore).toBe(0.9);
    });

    it("decreases with invalid snapshots", () => {
      const result = computeScoring(makeScorer(), makeMetrics(), [
        makeSnapshot({ sourceFileCount: 10 }),
        makeSnapshot({ sourceFileCount: 0 }),
      ]);
      // snapshotRatio = 1/2 = 0.5
      expect(result.confidenceScore).toBe(0.5);
    });

    it("clamps to 0 when penalties exceed ratio", () => {
      const scorer = makeScorer({
        dataQualityWarnings: Array(25).fill("warning"),
      });
      const result = computeScoring(scorer, makeMetrics(), [makeSnapshot()]);
      expect(result.confidenceScore).toBe(0);
    });
  });

  describe("rubric caps and floors", () => {
    it("caps Eng. Practices at 0.4 when all repos have no tests and no build system", () => {
      const scorer = makeScorer({
        radarAxes: [
          { axis: "Code Quality", value: 0.8 },
          { axis: "Project Complexity", value: 0.7 },
          { axis: "Technical Breadth", value: 0.6 },
          { axis: "Eng. Practices", value: 0.9 },
          { axis: "Consistency", value: 0.65 },
          { axis: "Collaboration", value: 0.5 },
        ],
      });
      const snapshots = [
        makeSnapshot({ name: "a", hasTests: false, hasBuildSystem: false }),
        makeSnapshot({ name: "b", hasTests: false, hasBuildSystem: false }),
      ];
      const result = computeScoring(scorer, makeMetrics(), snapshots);
      expect(result.radarBreakdownScores["Eng. Practices"]).toBe(4); // 0.4 * 10
    });

    it("caps Eng. Practices at 0.6 when all repos have no tests but have build system", () => {
      const scorer = makeScorer({
        radarAxes: [
          { axis: "Code Quality", value: 0.8 },
          { axis: "Project Complexity", value: 0.7 },
          { axis: "Technical Breadth", value: 0.6 },
          { axis: "Eng. Practices", value: 0.9 },
          { axis: "Consistency", value: 0.65 },
          { axis: "Collaboration", value: 0.5 },
        ],
      });
      const snapshots = [
        makeSnapshot({ name: "a", hasTests: false, hasBuildSystem: true }),
        makeSnapshot({ name: "b", hasTests: false, hasBuildSystem: true }),
      ];
      const result = computeScoring(scorer, makeMetrics(), snapshots);
      expect(result.radarBreakdownScores["Eng. Practices"]).toBe(6); // 0.6 * 10
    });

    it("caps Eng. Practices at 0.6 when all repos have no CI", () => {
      const scorer = makeScorer({
        radarAxes: [
          { axis: "Code Quality", value: 0.8 },
          { axis: "Project Complexity", value: 0.7 },
          { axis: "Technical Breadth", value: 0.6 },
          { axis: "Eng. Practices", value: 0.9 },
          { axis: "Consistency", value: 0.65 },
          { axis: "Collaboration", value: 0.5 },
        ],
      });
      const snapshots = [
        makeSnapshot({ name: "a", hasCI: false }),
        makeSnapshot({ name: "b", hasCI: false }),
      ];
      const result = computeScoring(scorer, makeMetrics(), snapshots);
      expect(result.radarBreakdownScores["Eng. Practices"]).toBe(6);
    });

    it("applies -0.1 penalty to Code Quality when all repos have no lint config", () => {
      const scorer = makeScorer({
        radarAxes: [
          { axis: "Code Quality", value: 0.8 },
          { axis: "Project Complexity", value: 0.7 },
          { axis: "Technical Breadth", value: 0.6 },
          { axis: "Eng. Practices", value: 0.75 },
          { axis: "Consistency", value: 0.65 },
          { axis: "Collaboration", value: 0.5 },
        ],
      });
      const snapshots = [
        makeSnapshot({ name: "a", hasLintConfig: false }),
        makeSnapshot({ name: "b", hasLintConfig: false }),
      ];
      const result = computeScoring(scorer, makeMetrics(), snapshots);
      expect(result.radarBreakdownScores["Code Quality"]).toBe(7); // (0.8 - 0.1) * 10
    });

    it("caps Consistency at 0.3 when medianLatestPushDaysAgo > 365", () => {
      const scorer = makeScorer({
        radarAxes: [
          { axis: "Code Quality", value: 0.8 },
          { axis: "Project Complexity", value: 0.7 },
          { axis: "Technical Breadth", value: 0.6 },
          { axis: "Eng. Practices", value: 0.75 },
          { axis: "Consistency", value: 0.9 },
          { axis: "Collaboration", value: 0.5 },
        ],
      });
      const result = computeScoring(
        scorer,
        makeMetrics({ medianLatestPushDaysAgo: 500 }),
        [makeSnapshot()],
      );
      expect(result.radarBreakdownScores["Consistency"]).toBe(3); // 0.3 * 10
    });

    it("caps Collaboration at 0.3 when all repos are solo with no PRs", () => {
      const scorer = makeScorer({
        radarAxes: [
          { axis: "Code Quality", value: 0.8 },
          { axis: "Project Complexity", value: 0.7 },
          { axis: "Technical Breadth", value: 0.6 },
          { axis: "Eng. Practices", value: 0.75 },
          { axis: "Consistency", value: 0.65 },
          { axis: "Collaboration", value: 0.8 },
        ],
      });
      const snapshots = [
        makeSnapshot({ name: "a", contributorCount: 1, pullRequestsCount: 0 }),
        makeSnapshot({ name: "b", contributorCount: 1, pullRequestsCount: 0 }),
      ];
      const result = computeScoring(scorer, makeMetrics(), snapshots);
      expect(result.radarBreakdownScores["Collaboration"]).toBe(3); // 0.3 * 10
    });

    it("floors Collaboration at 0.5 when any repo has >= 50 contributors", () => {
      const scorer = makeScorer({
        radarAxes: [
          { axis: "Code Quality", value: 0.8 },
          { axis: "Project Complexity", value: 0.7 },
          { axis: "Technical Breadth", value: 0.6 },
          { axis: "Eng. Practices", value: 0.75 },
          { axis: "Consistency", value: 0.65 },
          { axis: "Collaboration", value: 0.2 },
        ],
      });
      const snapshots = [
        makeSnapshot({ name: "a", contributorCount: 60, pullRequestsCount: 0 }),
        makeSnapshot({ name: "b", contributorCount: 1, pullRequestsCount: 0 }),
      ];
      const result = computeScoring(scorer, makeMetrics(), snapshots);
      expect(result.radarBreakdownScores["Collaboration"]).toBe(5); // 0.5 * 10
    });

    it("floors Collaboration at 0.7 when any repo has >= 500 contributors", () => {
      const scorer = makeScorer({
        radarAxes: [
          { axis: "Code Quality", value: 0.8 },
          { axis: "Project Complexity", value: 0.7 },
          { axis: "Technical Breadth", value: 0.6 },
          { axis: "Eng. Practices", value: 0.75 },
          { axis: "Consistency", value: 0.65 },
          { axis: "Collaboration", value: 0.2 },
        ],
      });
      const snapshots = [
        makeSnapshot({ name: "a", contributorCount: 600, pullRequestsCount: 0 }),
        makeSnapshot({ name: "b", contributorCount: 1, pullRequestsCount: 0 }),
      ];
      const result = computeScoring(scorer, makeMetrics(), snapshots);
      expect(result.radarBreakdownScores["Collaboration"]).toBe(7); // 0.7 * 10
    });

    it("does not apply caps when conditions are not met", () => {
      // All repos have tests, CI, lint — no caps should fire
      const scorer = makeScorer();
      const snapshots = [
        makeSnapshot({ name: "a", hasTests: true, hasCI: true, hasLintConfig: true, contributorCount: 3, pullRequestsCount: 5 }),
        makeSnapshot({ name: "b", hasTests: true, hasCI: true, hasLintConfig: true, contributorCount: 2, pullRequestsCount: 3 }),
      ];
      const result = computeScoring(scorer, makeMetrics(), snapshots);
      // Original values should pass through
      expect(result.radarBreakdownScores["Eng. Practices"]).toBe(8); // round(0.75 * 10)
      expect(result.radarBreakdownScores["Code Quality"]).toBe(8);
      expect(result.radarBreakdownScores["Collaboration"]).toBe(5);
    });

    it("writes capped values back to scorer.radarAxes", () => {
      const scorer = makeScorer({
        radarAxes: [
          { axis: "Code Quality", value: 0.8 },
          { axis: "Project Complexity", value: 0.7 },
          { axis: "Technical Breadth", value: 0.6 },
          { axis: "Eng. Practices", value: 0.9 },
          { axis: "Consistency", value: 0.65 },
          { axis: "Collaboration", value: 0.5 },
        ],
      });
      const snapshots = [
        makeSnapshot({ name: "a", hasTests: false, hasBuildSystem: false }),
        makeSnapshot({ name: "b", hasTests: false, hasBuildSystem: false }),
      ];
      computeScoring(scorer, makeMetrics(), snapshots);
      const ep = scorer.radarAxes.find((a) => a.axis === "Eng. Practices");
      expect(ep!.value).toBe(0.4);
    });
  });

  describe("metadata", () => {
    it("returns rubricVersion v1.1", () => {
      const result = computeScoring(makeScorer(), makeMetrics(), [makeSnapshot()]);
      expect(result.rubricVersion).toBe("v1.1");
    });

    it("returns modelVersion from env", () => {
      const result = computeScoring(makeScorer(), makeMetrics(), [makeSnapshot()]);
      expect(result.modelVersion).toBeDefined();
      expect(typeof result.modelVersion).toBe("string");
    });
  });
});

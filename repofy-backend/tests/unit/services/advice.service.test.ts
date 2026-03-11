import { describe, it, expect, vi, beforeEach } from "vitest";
import { createGitHubUserData } from "../../fixtures/github";
import { createAdviceV2Raw } from "../../fixtures/ai";
import { getMockCreate } from "../../helpers/mock-openai";
import { GENERATION_WARNINGS } from "../../../src/types";
import type { AdviceV2Raw, AdviceSectionName } from "../../../src/types";

vi.mock("openai");

import {
  generateAdvice,
  normalizeAdvice,
  isMetricMeasurable,
  mergeAdvice,
  buildRetrySchema,
} from "../../../src/services/advice.service";

describe("advice.service", () => {
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockCreate = await getMockCreate();
    mockCreate.mockReset();
  });

  // ── Parsing ──────────────────────────────────────────────────────

  describe("generateAdvice — parsing", () => {
    it("returns parsed v2 response with schemaVersion and generationWarnings", async () => {
      const raw = createAdviceV2Raw();
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(raw) } }],
        usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 },
      });

      const result = await generateAdvice(createGitHubUserData());

      expect(result.schemaVersion).toBe("v2");
      expect(result.generationWarnings).toEqual(expect.any(Array));
      expect(result.summary).toBe(raw.summary);
      expect(result.trajectory.currentEstimate).toBe("Junior");
      expect(result.buildRoadmap).toHaveLength(3);
      expect(result.weeklyRoadmap).toHaveLength(12);
    });

    it("throws on empty response", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: null } }],
        usage: { prompt_tokens: 100, completion_tokens: 0, total_tokens: 100 },
      });

      await expect(generateAdvice(createGitHubUserData())).rejects.toThrow(
        "OpenAI returned empty response",
      );
    });

    it("throws on malformed JSON from OpenAI", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: "not valid json {{{" } }],
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      });

      await expect(generateAdvice(createGitHubUserData())).rejects.toThrow(SyntaxError);
    });

    it("propagates OpenAI API errors", async () => {
      mockCreate.mockRejectedValueOnce(new Error("429 Rate limit exceeded"));

      await expect(generateAdvice(createGitHubUserData())).rejects.toThrow(
        "429 Rate limit exceeded",
      );
    });

    it("emits SKILL_ROADMAP_REDUCED on clean path when normalization reduces skills", async () => {
      // 5 skills, 3 overlap with existing stack (TypeScript, JavaScript, Web)
      const raw = createAdviceV2Raw({
        skillRoadmap: [
          { skill: "TypeScript", priority: "Now", demandLevel: "High", relatedTo: "JS", reason: "Core lang", proofOfLearning: "Use in build", evidence: "Already used" },
          { skill: "JavaScript", priority: "Now", demandLevel: "High", relatedTo: "TS", reason: "Core lang", proofOfLearning: "Use in build", evidence: "Already used" },
          { skill: "Web", priority: "Next", demandLevel: "Growing", relatedTo: "Frontend", reason: "Core topic", proofOfLearning: "Use in build", evidence: "Already used" },
          { skill: "Docker", priority: "Now", demandLevel: "High", relatedTo: "Node.js", reason: "Essential", proofOfLearning: "Add Dockerfile", evidence: "No Dockerfiles" },
          { skill: "GraphQL", priority: "Next", demandLevel: "Growing", relatedTo: "REST", reason: "Growing paradigm", proofOfLearning: "Add endpoint", evidence: "REST only" },
        ],
      });
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(raw) } }],
        usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 },
      });

      const result = await generateAdvice(createGitHubUserData());

      // Should take early return (no validation errors), but still emit cardinality warning
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(result.skillRoadmap).toHaveLength(2);
      expect(result.generationWarnings).toContain(GENERATION_WARNINGS.SKILL_ROADMAP_REDUCED);
    });

    it("passes signal to OpenAI client", async () => {
      const raw = createAdviceV2Raw();
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(raw) } }],
        usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 },
      });

      const controller = new AbortController();
      await generateAdvice(createGitHubUserData(), controller.signal);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ signal: controller.signal }),
      );
    });
  });

  // ── Normalization ────────────────────────────────────────────────

  describe("normalizeAdvice", () => {
    it("filters invalid repo names", () => {
      const raw = createAdviceV2Raw({
        repoImprovements: [
          { repoName: "cool-project", improvements: [{ area: "Testing", suggestion: "Add tests.", priority: "High", expectedOutcome: "Coverage." }] },
          { repoName: "NONEXISTENT", improvements: [{ area: "Testing", suggestion: "Add tests.", priority: "High", expectedOutcome: "Coverage." }] },
        ],
      });

      const { normalized, errors } = normalizeAdvice(raw, createGitHubUserData());

      expect(normalized.repoImprovements).toHaveLength(1);
      expect(normalized.repoImprovements[0].repoName).toBe("cool-project");
      expect(errors).toHaveLength(1);
      expect(errors[0].section).toBe("repoImprovements");
    });

    it("removes existing-stack skills", () => {
      const raw = createAdviceV2Raw({
        skillRoadmap: [
          { skill: "TypeScript", priority: "Now", demandLevel: "High", relatedTo: "JS", reason: "...", proofOfLearning: "...", evidence: "..." },
          { skill: "Docker", priority: "Now", demandLevel: "High", relatedTo: "Node.js", reason: "...", proofOfLearning: "...", evidence: "..." },
        ],
      });

      const github = createGitHubUserData();
      const { normalized } = normalizeAdvice(raw, github);

      // TypeScript is in existing stack, Docker is not
      expect(normalized.skillRoadmap).toHaveLength(1);
      expect(normalized.skillRoadmap[0].skill).toBe("Docker");
    });

    it("normalizes weekly roadmap order", () => {
      const raw = createAdviceV2Raw();
      // Scramble week order
      raw.weeklyRoadmap = [...raw.weeklyRoadmap].reverse();

      const { normalized } = normalizeAdvice(raw, createGitHubUserData());

      expect(normalized.weeklyRoadmap.map((w) => w.week)).toEqual(
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      );
    });

    it("validates activeBuildTitle references", () => {
      const raw = createAdviceV2Raw();
      raw.weeklyRoadmap[0].activeBuildTitle = "NONEXISTENT BUILD";

      const { errors } = normalizeAdvice(raw, createGitHubUserData());

      const weeklyErrors = errors.filter((e) => e.section === "weeklyRoadmap");
      expect(weeklyErrors.length).toBeGreaterThan(0);
      expect(weeklyErrors[0].message).toContain("invalid activeBuildTitle");
    });

    it("validates build sequence coherence", () => {
      const raw = createAdviceV2Raw();
      const titles = raw.buildRoadmap.map((b) => b.title);
      // Create oscillating pattern: build3, build1, build3, build1...
      raw.weeklyRoadmap = raw.weeklyRoadmap.map((w, i) => ({
        ...w,
        activeBuildTitle: i % 2 === 0 ? titles[2] : titles[0],
      }));

      const { errors } = normalizeAdvice(raw, createGitHubUserData());

      const coherenceErrors = errors.filter((e) =>
        e.message.includes("oscillates"),
      );
      expect(coherenceErrors.length).toBeGreaterThan(0);
    });

    it("validates estimatedWeeks sum", () => {
      const raw = createAdviceV2Raw();
      raw.buildRoadmap[0].estimatedWeeks = 6;
      raw.buildRoadmap[1].estimatedWeeks = 6;
      raw.buildRoadmap[2].estimatedWeeks = 6;

      const { errors } = normalizeAdvice(raw, createGitHubUserData());

      const sumErrors = errors.filter((e) => e.message.includes("estimatedWeeks sum"));
      expect(sumErrors).toHaveLength(1);
      expect(sumErrors[0].message).toContain("18");
    });

    it("validates build sub-array minima", () => {
      const raw = createAdviceV2Raw();
      raw.buildRoadmap[0].techStack = ["Node.js", "Express"];       // < 3
      raw.buildRoadmap[1].milestones = ["Step 1", "Step 2"];         // < 3
      raw.buildRoadmap[2].hiringSignals = ["One signal"];             // < 2

      const { errors } = normalizeAdvice(raw, createGitHubUserData());

      const buildErrors = errors.filter((e) => e.section === "buildRoadmap");
      expect(buildErrors.some((e) => e.message.includes("techStack") && e.message.includes("minimum 3"))).toBe(true);
      expect(buildErrors.some((e) => e.message.includes("milestones") && e.message.includes("minimum 3"))).toBe(true);
      expect(buildErrors.some((e) => e.message.includes("hiringSignals") && e.message.includes("minimum 2"))).toBe(true);
    });

    it("validates contributionStrategy minimum count", () => {
      const raw = createAdviceV2Raw({
        contributionStrategy: [
          { title: "A", detail: "Detail A", evidence: "Evidence A" },
          { title: "B", detail: "Detail B", evidence: "Evidence B" },
        ],
      });

      const { errors } = normalizeAdvice(raw, createGitHubUserData());

      const csErrors = errors.filter((e) => e.section === "contributionStrategy");
      expect(csErrors).toHaveLength(1);
      expect(csErrors[0].message).toContain("minimum 3");
    });

    it("validates profileOptimizations minimum count", () => {
      const raw = createAdviceV2Raw({
        profileOptimizations: [
          { area: "Bio", current: "Missing", suggestion: "Add bio", example: "Full-stack dev", impact: "First impression" },
          { area: "Readme", current: "Missing", suggestion: "Add readme", example: "Tech badges", impact: "Stands out" },
          { area: "Pins", current: "Default", suggestion: "Pin repos", example: "Pin best 3", impact: "Curated view" },
        ],
      });

      const { errors } = normalizeAdvice(raw, createGitHubUserData());

      const poErrors = errors.filter((e) => e.section === "profileOptimizations");
      expect(poErrors).toHaveLength(1);
      expect(poErrors[0].message).toContain("minimum 4");
    });

    it("detects empty skillTask", () => {
      const raw = createAdviceV2Raw();
      raw.weeklyRoadmap[0].skillTask = "";
      raw.weeklyRoadmap[3].skillTask = "  ";

      const { errors } = normalizeAdvice(raw, createGitHubUserData());

      const skillTaskErrors = errors.filter((e) =>
        e.message.includes("empty skillTask"),
      );
      expect(skillTaskErrors).toHaveLength(1);
    });
  });

  // ── Metrics validation ───────────────────────────────────────────

  describe("isMetricMeasurable", () => {
    it("Pattern A: passes numeric target with measurable context", () => {
      expect(isMetricMeasurable("Reach 3+ merged PRs to OSS repos outside personal projects")).toBe(true);
      expect(isMetricMeasurable("Deploy two production apps with CI/CD pipelines within 12 weeks")).toBe(true);
    });

    it("Pattern A: rejects number without deliverable or timeframe context", () => {
      expect(isMetricMeasurable("Score at least 80 on the coding assessment and demonstrate real improvement")).toBe(false);
      expect(isMetricMeasurable("Complete the program in approximately 6 stages for maximum learning and growth")).toBe(false);
    });

    it("Pattern B: passes binary deliverable", () => {
      expect(isMetricMeasurable("Ship a working CI pipeline for the portfolio project successfully")).toBe(true);
      expect(isMetricMeasurable("Publish a blog post documenting the authentication build process")).toBe(true);
    });

    it("Pattern C: passes timeframe-bound outcome", () => {
      expect(isMetricMeasurable("Maintain weekly commit streak for 12 consecutive weeks of activity")).toBe(true);
      expect(isMetricMeasurable("By week 8, have all 3 builds deployed with public URLs")).toBe(true);
    });

    it("rejects under 8 words", () => {
      expect(isMetricMeasurable("Ship 3 PRs")).toBe(false);
    });

    it("rejects vague verb starts", () => {
      expect(isMetricMeasurable("Improve your GitHub presence significantly over the next few months")).toBe(false);
      expect(isMetricMeasurable("Get better at testing your code consistently across all projects")).toBe(false);
      expect(isMetricMeasurable("Learn more about cloud infrastructure and deployment best practices")).toBe(false);
      expect(isMetricMeasurable("Enhance your profile by adding more projects and contributions regularly")).toBe(false);
      expect(isMetricMeasurable("Grow your network by connecting with more developers in the community")).toBe(false);
    });

    it("rejects no qualifying content", () => {
      expect(isMetricMeasurable("Eventually improve code quality across all your repositories and projects")).toBe(false);
    });
  });

  // ── Retry ────────────────────────────────────────────────────────

  describe("section-level retry", () => {
    it("triggers retry when sections fail and uses only failed section keys in schema", async () => {
      // Attempt 1: valid v2 but with hallucinated repo name
      const raw = createAdviceV2Raw({
        repoImprovements: [
          { repoName: "HALLUCINATED", improvements: [{ area: "Testing", suggestion: "Add tests.", priority: "High", expectedOutcome: "Coverage." }] },
        ],
      });
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(raw) } }],
        usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 },
      });

      // Attempt 2: retry returns corrected repoImprovements
      const retryResponse = {
        repoImprovements: [
          { repoName: "cool-project", improvements: [{ area: "Testing", suggestion: "Fixed.", priority: "High", expectedOutcome: "Coverage." }] },
        ],
      };
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(retryResponse) } }],
        usage: { prompt_tokens: 50, completion_tokens: 50, total_tokens: 100 },
      });

      const result = await generateAdvice(createGitHubUserData());

      // Should have called OpenAI twice
      expect(mockCreate).toHaveBeenCalledTimes(2);

      // Retry schema should only contain failed section keys
      const retryCall = mockCreate.mock.calls[1][0];
      const retrySchemaProps = Object.keys(retryCall.response_format.json_schema.schema.properties);
      expect(retrySchemaProps).toContain("repoImprovements");
      // Should not contain sections that passed
      expect(retrySchemaProps).not.toContain("summary");
      expect(retrySchemaProps).not.toContain("buildRoadmap");
    });

    it("builds dynamic retry schema with only failed keys", () => {
      const schema = buildRetrySchema(["repoImprovements", "successMetrics"]);

      expect(schema.name).toBe("advice_v2_retry");
      expect(schema.schema.required).toEqual(["repoImprovements", "successMetrics"]);
      expect(Object.keys(schema.schema.properties)).toEqual(["repoImprovements", "successMetrics"]);
    });
  });

  // ── Merge ────────────────────────────────────────────────────────

  describe("mergeAdvice", () => {
    const github = createGitHubUserData();

    it("keeps attempt 1 for passed sections", () => {
      const attempt1 = createAdviceV2Raw();
      const attempt2: Partial<AdviceV2Raw> = {
        summary: "REPLACED SUMMARY",
        repoImprovements: [],
      };

      const { advice } = mergeAdvice(attempt1, attempt2, ["repoImprovements"], github);

      // summary passed in attempt 1 — keep it
      expect(advice.summary).toBe(attempt1.summary);
    });

    it("replaces failed sections with attempt 2 values", () => {
      const attempt1 = createAdviceV2Raw({
        repoImprovements: [
          { repoName: "HALLUCINATED", improvements: [{ area: "Testing", suggestion: "...", priority: "High", expectedOutcome: "..." }] },
        ],
      });
      const attempt2: Partial<AdviceV2Raw> = {
        repoImprovements: [
          { repoName: "cool-project", improvements: [{ area: "Testing", suggestion: "Fixed.", priority: "High", expectedOutcome: "Fixed." }] },
        ],
      };

      const { advice } = mergeAdvice(attempt1, attempt2, ["repoImprovements"], github);

      expect(advice.repoImprovements![0].repoName).toBe("cool-project");
    });

    it("discards unexpected keys from attempt 2", () => {
      const attempt1 = createAdviceV2Raw();
      const attempt2 = {
        repoImprovements: [],
        summary: "SHOULD BE DISCARDED",
      } as Partial<AdviceV2Raw>;

      const { advice } = mergeAdvice(attempt1, attempt2, ["repoImprovements"], github);

      // summary was not in failedSections, so attempt2's value is discarded
      expect(advice.summary).toBe(attempt1.summary);
    });

    it("accepts partial keys and degrades remaining", () => {
      const attempt1 = createAdviceV2Raw({
        repoImprovements: [
          { repoName: "HALLUCINATED", improvements: [{ area: "Testing", suggestion: "...", priority: "High", expectedOutcome: "..." }] },
        ],
      });
      // Attempt 2 only fixes repoImprovements, not successMetrics
      const attempt2: Partial<AdviceV2Raw> = {
        repoImprovements: [
          { repoName: "cool-project", improvements: [{ area: "Testing", suggestion: "Fixed.", priority: "High", expectedOutcome: "Fixed." }] },
        ],
      };

      const { advice, warnings } = mergeAdvice(
        attempt1, attempt2,
        ["repoImprovements", "successMetrics" as AdviceSectionName],
        github,
      );

      expect(advice.repoImprovements![0].repoName).toBe("cool-project");
      // successMetrics was not in attempt2, so it should be degraded or kept from attempt1
      expect(advice.successMetrics).toBeDefined();
    });

    it("degrades all failed sections when attempt 2 is null", () => {
      const attempt1 = createAdviceV2Raw({
        repoImprovements: [
          { repoName: "HALLUCINATED", improvements: [{ area: "Testing", suggestion: "...", priority: "High", expectedOutcome: "..." }] },
        ],
      });

      const { advice, warnings } = mergeAdvice(
        attempt1, null, ["repoImprovements"], github,
      );

      expect(advice.repoImprovements).toEqual([]);
      expect(warnings).toContain(GENERATION_WARNINGS.REPO_IMPROVEMENTS_UNAVAILABLE);
    });
  });

  // ── Degrade ──────────────────────────────────────────────────────

  describe("degrade behaviors", () => {
    it("degrades repoImprovements to empty array + warning", () => {
      const attempt1 = createAdviceV2Raw({
        repoImprovements: [
          { repoName: "HALLUCINATED", improvements: [{ area: "Testing", suggestion: "...", priority: "High", expectedOutcome: "..." }] },
        ],
      });

      const { advice, warnings } = mergeAdvice(
        attempt1, null, ["repoImprovements"], createGitHubUserData(),
      );

      expect(advice.repoImprovements).toEqual([]);
      expect(warnings).toContain(GENERATION_WARNINGS.REPO_IMPROVEMENTS_UNAVAILABLE);
    });

    it("synthesizes weeklyRoadmap from milestones + warning", () => {
      const attempt1 = createAdviceV2Raw();
      // Corrupt weeklyRoadmap
      attempt1.weeklyRoadmap = [];

      const { advice, warnings } = mergeAdvice(
        attempt1, null, ["weeklyRoadmap"], createGitHubUserData(),
      );

      expect(advice.weeklyRoadmap).toHaveLength(12);
      expect(advice.weeklyRoadmap![0].activeBuildTitle).toBe(attempt1.buildRoadmap[0].title);
      expect(warnings).toContain(GENERATION_WARNINGS.WEEKLY_ROADMAP_SYNTHESIZED);
    });

    it("filters successMetrics keeping valid measurable subset + warning", () => {
      const attempt1 = createAdviceV2Raw({
        successMetrics: [
          "Improve GitHub presence.", // fails — under 8 words
          "Reach 3+ merged PRs to OSS repos outside personal projects.", // passes
        ],
      });

      const { advice, warnings } = mergeAdvice(
        attempt1, null, ["successMetrics"], createGitHubUserData(),
      );

      // Degrade keeps the measurable subset instead of discarding all
      expect(advice.successMetrics).toHaveLength(1);
      expect(advice.successMetrics![0]).toContain("3+ merged PRs");
      expect(warnings).toContain(GENERATION_WARNINGS.SUCCESS_METRICS_REDUCED);
    });

    it("throws for critical section failure", async () => {
      // buildRoadmap with only 1 item (needs exactly 3)
      const raw = createAdviceV2Raw();
      raw.buildRoadmap = [raw.buildRoadmap[0]];

      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(raw) } }],
        usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 },
      });

      // Retry also fails
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify({ buildRoadmap: [raw.buildRoadmap[0]] }) } }],
        usage: { prompt_tokens: 50, completion_tokens: 50, total_tokens: 100 },
      });

      await expect(generateAdvice(createGitHubUserData())).rejects.toThrow(
        /Critical advice sections failed/,
      );
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createScorerResponse, createScoringResult } from "../../fixtures/ai";
import { getMockCreate } from "../../helpers/mock-openai";

vi.mock("openai");

import { generateNarrativeReport } from "../../../src/services/openai.service";

function buildLockedLine(scoring: ReturnType<typeof createScoringResult>): string {
  return `LOCKED: score=${scoring.overallScore} level=${scoring.candidateLevel} rec=${scoring.recommendation}`;
}

describe("generateNarrativeReport", () => {
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockCreate = await getMockCreate();
    mockCreate.mockReset();
  });

  it("returns stripped prose on happy path with valid LOCKED_LINE", async () => {
    const scorer = createScorerResponse();
    const scoring = createScoringResult();
    const locked = buildLockedLine(scoring);
    const prose = "This is paragraph one.\n\nThis is paragraph two.\n\nThis is paragraph three.";

    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: `${prose}\n${locked}` } }],
    });

    const result = await generateNarrativeReport(scorer, scoring);

    expect(result).toBe(prose);
    expect(result).not.toContain("LOCKED:");
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("retries on LOCKED_LINE mismatch and succeeds on second attempt", async () => {
    const scorer = createScorerResponse();
    const scoring = createScoringResult();
    const locked = buildLockedLine(scoring);
    const prose = "Good developer with solid skills.\n\nStrengths include testing.\n\nSome areas need work.";

    // First attempt: wrong locked line
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: `${prose}\nLOCKED: score=99 level=Staff rec=Strong Hire` } }],
    });

    // Second attempt: correct locked line
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: `${prose}\n${locked}` } }],
    });

    const result = await generateNarrativeReport(scorer, scoring);

    expect(result).toBe(prose);
    expect(mockCreate).toHaveBeenCalledTimes(2);

    // First call at temperature 0.5, second at 0.2
    const firstCall = mockCreate.mock.calls[0][0];
    const secondCall = mockCreate.mock.calls[1][0];
    expect(firstCall.temperature).toBe(0.5);
    expect(secondCall.temperature).toBe(0.2);
  });

  it("falls back to template when both attempts fail", async () => {
    const scorer = createScorerResponse();
    const scoring = createScoringResult();

    // Both attempts return wrong locked line
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "Some text\nLOCKED: score=0 level=Junior rec=No Hire" } }],
    });

    const result = await generateNarrativeReport(scorer, scoring);

    expect(mockCreate).toHaveBeenCalledTimes(2);

    // Fallback should be 3 paragraphs separated by blank lines
    const paragraphs = result.split("\n\n");
    expect(paragraphs.length).toBe(3);

    // Fallback should NOT start with score/level/recommendation
    expect(result).not.toMatch(/^This candidate scores/);
    expect(result).not.toMatch(/^Overall Score:/);
    expect(result).not.toMatch(/^Candidate Level:/);
  });

  it("falls back when API call throws an error", async () => {
    const scorer = createScorerResponse();
    const scoring = createScoringResult();

    mockCreate.mockRejectedValue(new Error("API error"));

    const result = await generateNarrativeReport(scorer, scoring);

    // Should return fallback prose, not throw
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);

    const paragraphs = result.split("\n\n");
    expect(paragraphs.length).toBe(3);
  });

  it("falls back when API returns empty content", async () => {
    const scorer = createScorerResponse();
    const scoring = createScoringResult();

    mockCreate.mockResolvedValue({
      choices: [{ message: { content: null } }],
    });

    const result = await generateNarrativeReport(scorer, scoring);

    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
    const paragraphs = result.split("\n\n");
    expect(paragraphs.length).toBe(3);
  });

  it("fallback mentions confidence percentage", async () => {
    const scorer = createScorerResponse();
    const scoring = createScoringResult({ confidenceScore: 0.85 });

    mockCreate.mockRejectedValue(new Error("fail"));

    const result = await generateNarrativeReport(scorer, scoring);

    expect(result).toContain("85%");
  });

  it("fallback always includes hiring recommendation sentence", async () => {
    const scorer = createScorerResponse();
    const scoring = createScoringResult({ recommendation: "Hire" });

    mockCreate.mockRejectedValue(new Error("fail"));

    const result = await generateNarrativeReport(scorer, scoring);

    expect(result).toContain('"hire"');
  });

  it("fallback p2 has at least 3 sentences even with empty topRepos", async () => {
    const scorer = createScorerResponse({ topRepos: [] });
    const scoring = createScoringResult();

    mockCreate.mockRejectedValue(new Error("fail"));

    const result = await generateNarrativeReport(scorer, scoring);

    const paragraphs = result.split("\n\n");
    expect(paragraphs).toHaveLength(3);
    // p2 should have at least 3 sentences
    const p2 = paragraphs[1];
    const sentenceCount = p2.split(/\.\s/).length;
    expect(sentenceCount).toBeGreaterThanOrEqual(3);
  });

  it("fallback p3 has at least 3 sentences even with no weaknesses/risks", async () => {
    const scorer = createScorerResponse({
      weaknesses: [],
      redFlags: [],
    });
    const scoring = createScoringResult({
      riskSignals: { concerningCount: 0, notableCount: 0 },
    });

    mockCreate.mockRejectedValue(new Error("fail"));

    const result = await generateNarrativeReport(scorer, scoring);

    const paragraphs = result.split("\n\n");
    expect(paragraphs).toHaveLength(3);
    // p3 should have at least 3 sentences (count periods followed by space or end)
    const p3 = paragraphs[2];
    const sentenceCount = p3.split(/\.\s/).length;
    expect(sentenceCount).toBeGreaterThanOrEqual(3);
  });
});

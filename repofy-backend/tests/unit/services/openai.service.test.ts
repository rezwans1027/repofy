import { describe, it, expect, vi, beforeEach } from "vitest";
import { createGitHubUserData } from "../../fixtures/github";
import { createAIAnalysisResponse, createShuffledRadarResponse } from "../../fixtures/ai";
import { getMockCreate } from "../../helpers/mock-openai";

vi.mock("openai");

import { generateAnalysis } from "../../../src/services/openai.service";

describe("openai.service", () => {
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockCreate = await getMockCreate();
    mockCreate.mockReset();
  });

  describe("generateAnalysis", () => {
    it("returns parsed response", async () => {
      const analysisResponse = createAIAnalysisResponse();
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(analysisResponse) } }],
      });

      const result = await generateAnalysis(createGitHubUserData());

      expect(result.candidateLevel).toBe("Mid-Level");
      expect(result.overallScore).toBe(62);
      expect(result.radarAxes).toHaveLength(6);
    });

    it("normalizes shuffled radar axes to canonical order", async () => {
      const shuffledResponse = createShuffledRadarResponse();
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(shuffledResponse) } }],
      });

      const result = await generateAnalysis(createGitHubUserData());

      const axisOrder = result.radarAxes.map((a) => a.axis);
      expect(axisOrder).toEqual([
        "Code Quality",
        "Project Complexity",
        "Technical Breadth",
        "Eng. Practices",
        "Consistency",
        "Collaboration",
      ]);

      const breakdownOrder = result.radarBreakdown.map((b) => b.label);
      expect(breakdownOrder).toEqual([
        "Code Quality",
        "Project Complexity",
        "Technical Breadth",
        "Eng. Practices",
        "Consistency",
        "Collaboration",
      ]);
    });

    it("fills missing axes with defaults", async () => {
      const partial = createAIAnalysisResponse({
        radarAxes: [
          { axis: "Code Quality", value: 0.7 },
          { axis: "Collaboration", value: 0.4 },
        ],
        radarBreakdown: [
          { label: "Code Quality", score: 7, note: "Good." },
          { label: "Collaboration", score: 4, note: "Limited." },
        ],
      });
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(partial) } }],
      });

      const result = await generateAnalysis(createGitHubUserData());

      expect(result.radarAxes).toHaveLength(6);
      // Missing axes should have value 0
      const complexity = result.radarAxes.find((a) => a.axis === "Project Complexity");
      expect(complexity!.value).toBe(0);

      expect(result.radarBreakdown).toHaveLength(6);
      const complexityBreakdown = result.radarBreakdown.find((b) => b.label === "Project Complexity");
      expect(complexityBreakdown!.score).toBe(0);
      expect(complexityBreakdown!.note).toBe("");
    });

    it("throws on empty response", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: null } }],
      });

      await expect(generateAnalysis(createGitHubUserData())).rejects.toThrow(
        "OpenAI returned empty response",
      );
    });
  });
});

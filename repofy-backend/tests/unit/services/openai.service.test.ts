import { describe, it, expect, vi, beforeEach } from "vitest";
import { createGitHubUserData } from "../../fixtures/github";
import { createScorerResponse, createShuffledRadarResponse } from "../../fixtures/ai";
import { getMockCreate } from "../../helpers/mock-openai";

vi.mock("openai");

import { generateScorerResponse } from "../../../src/services/openai.service";

describe("openai.service", () => {
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockCreate = await getMockCreate();
    mockCreate.mockReset();
  });

  describe("generateScorerResponse", () => {
    it("returns parsed response", async () => {
      const scorerResponse = createScorerResponse();
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(scorerResponse) } }],
      });

      const result = await generateScorerResponse(createGitHubUserData());

      expect(result.radarAxes).toHaveLength(6);
      expect(result.dataQualityWarnings).toEqual([]);
    });

    it("normalizes shuffled radar axes to canonical order", async () => {
      const shuffledResponse = createShuffledRadarResponse();
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(shuffledResponse) } }],
      });

      const result = await generateScorerResponse(createGitHubUserData());

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
      const partial = createScorerResponse({
        radarAxes: [
          { axis: "Code Quality", value: 0.7 },
          { axis: "Collaboration", value: 0.4 },
        ],
        radarBreakdown: [
          { label: "Code Quality", note: "Good." },
          { label: "Collaboration", note: "Limited." },
        ],
      });
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(partial) } }],
      });

      const result = await generateScorerResponse(createGitHubUserData());

      expect(result.radarAxes).toHaveLength(6);
      const complexity = result.radarAxes.find((a) => a.axis === "Project Complexity");
      expect(complexity!.value).toBe(0);

      expect(result.radarBreakdown).toHaveLength(6);
      const complexityBreakdown = result.radarBreakdown.find((b) => b.label === "Project Complexity");
      expect(complexityBreakdown!.note).toBe("");
    });

    it("passes signal to OpenAI client", async () => {
      const scorerResponse = createScorerResponse();
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(scorerResponse) } }],
      });

      const controller = new AbortController();
      await generateScorerResponse(createGitHubUserData(), controller.signal);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ signal: controller.signal }),
      );
    });

    it("throws on empty response", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: null } }],
      });

      await expect(generateScorerResponse(createGitHubUserData())).rejects.toThrow(
        "OpenAI returned empty response",
      );
    });

    it("throws on malformed JSON from OpenAI", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: "not valid json {{{" } }],
      });

      await expect(generateScorerResponse(createGitHubUserData())).rejects.toThrow(SyntaxError);
    });

    it("propagates OpenAI API errors", async () => {
      mockCreate.mockRejectedValueOnce(new Error("429 Rate limit exceeded"));

      await expect(generateScorerResponse(createGitHubUserData())).rejects.toThrow(
        "429 Rate limit exceeded",
      );
    });

    it("deduplicates repeated repo names in topRepos", async () => {
      const dupe = {
        name: "cool-project",
        codeQuality: "Good" as const,
        testing: "Some" as const,
        cicd: "None" as const,
        verdict: "Solid" as const,
        isBestWork: false,
      };
      const response = createScorerResponse({
        topRepos: [
          { ...dupe, isBestWork: true },
          { ...dupe, codeQuality: "Excellent" as const },
          { ...dupe, verdict: "Strong" as const },
        ],
      });
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(response) } }],
      });

      const result = await generateScorerResponse(createGitHubUserData());

      expect(result.topRepos).toHaveLength(1);
      expect(result.topRepos[0].isBestWork).toBe(true);
    });

    it("filters all-invalid repo names to empty topRepos", async () => {
      const response = createScorerResponse({
        topRepos: [
          { name: "hallucinated-repo", codeQuality: "Good", testing: "Some", cicd: "None", verdict: "Solid", isBestWork: true },
          { name: "fake-project", codeQuality: "Excellent", testing: "Strong", cicd: "Present", verdict: "Standout", isBestWork: false },
        ],
      });
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(response) } }],
      });

      const result = await generateScorerResponse(createGitHubUserData());

      expect(result.topRepos).toHaveLength(0);
    });

    it("normalizes multiple isBestWork=true to exactly one", async () => {
      const response = createScorerResponse({
        topRepos: [
          { name: "cool-project", codeQuality: "Good", testing: "Some", cicd: "None", verdict: "Solid", isBestWork: true },
          { name: "another-repo", codeQuality: "Excellent", testing: "Strong", cicd: "Present", verdict: "Standout", isBestWork: true },
        ],
      });
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(response) } }],
      });

      const result = await generateScorerResponse(createGitHubUserData());

      const bestWork = result.topRepos.filter((r) => r.isBestWork);
      expect(bestWork).toHaveLength(1);
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createGitHubUserData } from "../../fixtures/github";
import { createAIAdviceResponse } from "../../fixtures/ai";
import { getMockCreate } from "../../helpers/mock-openai";

vi.mock("openai");

import { generateAdvice } from "../../../src/services/advice.service";

describe("advice.service", () => {
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockCreate = await getMockCreate();
    mockCreate.mockReset();
  });

  describe("generateAdvice", () => {
    it("returns parsed response", async () => {
      const adviceResponse = createAIAdviceResponse();
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(adviceResponse) } }],
      });

      const result = await generateAdvice(createGitHubUserData());

      expect(result.summary).toBe("Focus on testing and documentation.");
      expect(result.projectIdeas).toHaveLength(1);
      expect(result.repoImprovements).toHaveLength(1);
      expect(result.skillsToLearn).toHaveLength(1);
    });

    it("throws on empty response", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: null } }],
      });

      await expect(generateAdvice(createGitHubUserData())).rejects.toThrow(
        "OpenAI returned empty response",
      );
    });

    it("throws on malformed JSON from OpenAI", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: "not valid json {{{" } }],
      });

      await expect(generateAdvice(createGitHubUserData())).rejects.toThrow();
    });

    it("propagates OpenAI API errors", async () => {
      mockCreate.mockRejectedValueOnce(new Error("429 Rate limit exceeded"));

      await expect(generateAdvice(createGitHubUserData())).rejects.toThrow(
        "429 Rate limit exceeded",
      );
    });

    it("passes signal to OpenAI client", async () => {
      const adviceResponse = createAIAdviceResponse();
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(adviceResponse) } }],
      });

      const controller = new AbortController();
      await generateAdvice(createGitHubUserData(), controller.signal);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ signal: controller.signal }),
      );
    });
  });
});

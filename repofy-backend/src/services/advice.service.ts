import OpenAI from "openai";
import { env } from "../config/env";
import { ADVICE_SYSTEM_PROMPT } from "../lib/prompts";
import { buildUserMessage } from "../lib/build-user-message";
import type { GitHubUserData, AIAdviceResponse } from "../types";

const client = new OpenAI({ apiKey: env.openaiApiKey });

const ADVICE_JSON_SCHEMA = {
  name: "advice_response",
  strict: true,
  schema: {
    type: "object",
    properties: {
      summary: { type: "string" },
      projectIdeas: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            techStack: { type: "array", items: { type: "string" } },
            difficulty: {
              type: "string",
              enum: ["Beginner", "Intermediate", "Advanced"],
            },
            why: { type: "string" },
          },
          required: ["title", "description", "techStack", "difficulty", "why"],
          additionalProperties: false,
        },
      },
      repoImprovements: {
        type: "array",
        items: {
          type: "object",
          properties: {
            repoName: { type: "string" },
            improvements: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  area: {
                    type: "string",
                    enum: [
                      "Testing",
                      "Documentation",
                      "CI/CD",
                      "Code Quality",
                      "Architecture",
                    ],
                  },
                  suggestion: { type: "string" },
                  priority: {
                    type: "string",
                    enum: ["High", "Medium", "Low"],
                  },
                },
                required: ["area", "suggestion", "priority"],
                additionalProperties: false,
              },
            },
          },
          required: ["repoName", "improvements"],
          additionalProperties: false,
        },
      },
      skillsToLearn: {
        type: "array",
        items: {
          type: "object",
          properties: {
            skill: { type: "string" },
            reason: { type: "string" },
            demandLevel: {
              type: "string",
              enum: ["High", "Medium", "Growing"],
            },
            relatedTo: { type: "string" },
          },
          required: ["skill", "reason", "demandLevel", "relatedTo"],
          additionalProperties: false,
        },
      },
      contributionAdvice: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            detail: { type: "string" },
          },
          required: ["title", "detail"],
          additionalProperties: false,
        },
      },
      profileOptimizations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            area: { type: "string" },
            current: { type: "string" },
            suggestion: { type: "string" },
          },
          required: ["area", "current", "suggestion"],
          additionalProperties: false,
        },
      },
      actionPlan: {
        type: "array",
        items: {
          type: "object",
          properties: {
            timeframe: {
              type: "string",
              enum: ["30 days", "60 days", "90 days"],
            },
            actions: { type: "array", items: { type: "string" } },
          },
          required: ["timeframe", "actions"],
          additionalProperties: false,
        },
      },
    },
    required: [
      "summary",
      "projectIdeas",
      "repoImprovements",
      "skillsToLearn",
      "contributionAdvice",
      "profileOptimizations",
      "actionPlan",
    ],
    additionalProperties: false,
  },
} as const;

export async function generateAdvice(
  githubData: GitHubUserData,
  signal?: AbortSignal,
): Promise<AIAdviceResponse> {
  const userMessage = buildUserMessage(
    githubData,
    "Analyze this profile and provide actionable advice to improve it. Return the structured JSON response.",
  );

  const completion = await client.chat.completions.create({
    model: env.openaiModel,
    messages: [
      { role: "system", content: ADVICE_SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    response_format: {
      type: "json_schema",
      json_schema: ADVICE_JSON_SCHEMA,
    },
    temperature: 0.7,
  }, { signal });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned empty response");
  }

  return JSON.parse(content) as AIAdviceResponse;
}

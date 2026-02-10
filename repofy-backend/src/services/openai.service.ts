import OpenAI from "openai";
import { env } from "../config/env";
import { SYSTEM_PROMPT } from "../lib/prompts";
import { buildUserMessage } from "../lib/build-user-message";
import type { GitHubUserData, AIAnalysisResponse } from "../types";

const client = new OpenAI({ apiKey: env.openaiApiKey });

const JSON_SCHEMA = {
  name: "analysis_response",
  strict: true,
  schema: {
    type: "object",
    properties: {
      candidateLevel: {
        type: "string",
        enum: ["Junior", "Mid-Level", "Senior", "Staff"],
      },
      overallScore: { type: "number" },
      recommendation: {
        type: "string",
        enum: ["No Hire", "Weak Hire", "Hire", "Strong Hire"],
      },
      summary: { type: "string" },
      radarAxes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            axis: { type: "string" },
            value: { type: "number" },
          },
          required: ["axis", "value"],
          additionalProperties: false,
        },
      },
      radarBreakdown: {
        type: "array",
        items: {
          type: "object",
          properties: {
            label: { type: "string" },
            score: { type: "number" },
            note: { type: "string" },
          },
          required: ["label", "score", "note"],
          additionalProperties: false,
        },
      },
      statsInterpretation: { type: "string" },
      activityInterpretation: { type: "string" },
      languageInterpretation: { type: "string" },
      topRepos: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            codeQuality: { type: "string" },
            testing: { type: "string" },
            cicd: { type: "string" },
            verdict: { type: "string" },
            isBestWork: { type: "boolean" },
          },
          required: [
            "name",
            "codeQuality",
            "testing",
            "cicd",
            "verdict",
            "isBestWork",
          ],
          additionalProperties: false,
        },
      },
      strengths: {
        type: "array",
        items: {
          type: "object",
          properties: {
            text: { type: "string" },
            evidence: { type: "string" },
          },
          required: ["text", "evidence"],
          additionalProperties: false,
        },
      },
      weaknesses: {
        type: "array",
        items: {
          type: "object",
          properties: {
            text: { type: "string" },
            evidence: { type: "string" },
          },
          required: ["text", "evidence"],
          additionalProperties: false,
        },
      },
      redFlags: {
        type: "array",
        items: {
          type: "object",
          properties: {
            text: { type: "string" },
            severity: {
              type: "string",
              enum: ["Minor", "Notable", "Concerning"],
            },
            explanation: { type: "string" },
          },
          required: ["text", "severity", "explanation"],
          additionalProperties: false,
        },
      },
      interviewQuestions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            question: { type: "string" },
            why: { type: "string" },
          },
          required: ["question", "why"],
          additionalProperties: false,
        },
      },
    },
    required: [
      "candidateLevel",
      "overallScore",
      "recommendation",
      "summary",
      "radarAxes",
      "radarBreakdown",
      "statsInterpretation",
      "activityInterpretation",
      "languageInterpretation",
      "topRepos",
      "strengths",
      "weaknesses",
      "redFlags",
      "interviewQuestions",
    ],
    additionalProperties: false,
  },
} as const;

export async function generateAnalysis(
  githubData: GitHubUserData,
  signal?: AbortSignal,
): Promise<AIAnalysisResponse> {
  const userMessage = buildUserMessage(
    githubData,
    "Analyze this profile and return the structured JSON assessment.",
  );

  const completion = await client.chat.completions.create({
    model: env.openaiModel,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    response_format: {
      type: "json_schema",
      json_schema: JSON_SCHEMA,
    },
    temperature: 0.7,
  }, { signal });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned empty response");
  }

  return JSON.parse(content) as AIAnalysisResponse;
}

import OpenAI from "openai";
import { env } from "../config/env";
import { ADVICE_SYSTEM_PROMPT } from "../lib/prompts";
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

function buildUserMessage(data: GitHubUserData): string {
  const { profile, topRepositories, languages, activity, stats, contributions } = data;

  const repoSummaries = topRepositories.map(
    (r) =>
      `- ${r.name}: ${r.description || "No description"} | ` +
      `Language: ${r.language || "N/A"} | Stars: ${r.stars} | Forks: ${r.forks} | ` +
      `Topics: [${r.topics.join(", ")}] | Fork: ${r.isFork} | Archived: ${r.isArchived} | ` +
      `Last pushed: ${r.pushedAt}`,
  );

  const langSummary = languages
    .slice(0, 8)
    .map((l) => `${l.name}: ${l.percentage}% (${l.repoCount} repos)`)
    .join(", ");

  return `
GITHUB PROFILE:
- Username: ${profile.username}
- Name: ${profile.name || "N/A"}
- Bio: ${profile.bio || "N/A"}
- Company: ${profile.company || "N/A"}
- Location: ${profile.location || "N/A"}
- Blog/Website: ${profile.blog || "N/A"}
- Public repos: ${profile.publicRepos}
- Followers: ${profile.followers} | Following: ${profile.following}
- Account created: ${profile.createdAt}

STATS:
- Total stars: ${stats.totalStars}
- Total forks: ${stats.totalForks}
- Original repos (non-fork): ${stats.originalRepos}
- Account age: ${stats.accountAgeDays} days
- Total contributions (last year): ${contributions?.totalContributions ?? "N/A"}

TOP REPOSITORIES (up to 6):
${repoSummaries.join("\n")}

LANGUAGES: ${langSummary}

RECENT ACTIVITY (last 100 events):
- Total events: ${activity.totalEvents}
- Push events: ${activity.pushEvents}
- PR events: ${activity.prEvents}
- Issue events: ${activity.issueEvents}
- Review events: ${activity.reviewEvents}
- Recently active repos: ${activity.recentActiveRepos.slice(0, 5).join(", ")}

Analyze this profile and provide actionable advice to improve it. Return the structured JSON response.
`;
}

export async function generateAdvice(
  githubData: GitHubUserData,
): Promise<AIAdviceResponse> {
  const userMessage = buildUserMessage(githubData);

  const completion = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: ADVICE_SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    response_format: {
      type: "json_schema",
      json_schema: ADVICE_JSON_SCHEMA,
    },
    temperature: 0.7,
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned empty response");
  }

  return JSON.parse(content) as AIAdviceResponse;
}

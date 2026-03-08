import OpenAI from "openai";
import { env } from "../config/env";
import { SCORER_PROMPT, NARRATOR_PROMPT } from "../lib/prompts";
import { buildUserMessage } from "../lib/build-user-message";
import { logTokenUsage } from "../lib/usage-logger";
import { logger } from "../lib/logger";
import type { GitHubUserData, ScorerResponse, ScoringResult } from "../types";

let _client: OpenAI | null = null;
export function getClient(): OpenAI {
  if (!_client) _client = new OpenAI({ apiKey: env.openaiApiKey });
  return _client;
}

const SCORER_SCHEMA = {
  name: "scorer_response",
  strict: true,
  schema: {
    type: "object",
    properties: {
      radarAxes: {
        type: "array",
        minItems: 6,
        maxItems: 6,
        items: {
          type: "object",
          properties: {
            axis: {
              type: "string",
              enum: [
                "Code Quality",
                "Project Complexity",
                "Technical Breadth",
                "Eng. Practices",
                "Consistency",
                "Collaboration",
              ],
            },
            value: { type: "number", minimum: 0, maximum: 1 },
          },
          required: ["axis", "value"],
          additionalProperties: false,
        },
      },
      radarBreakdown: {
        type: "array",
        minItems: 6,
        maxItems: 6,
        items: {
          type: "object",
          properties: {
            label: {
              type: "string",
              enum: [
                "Code Quality",
                "Project Complexity",
                "Technical Breadth",
                "Eng. Practices",
                "Consistency",
                "Collaboration",
              ],
            },
            note: { type: "string" },
          },
          required: ["label", "note"],
          additionalProperties: false,
        },
      },
      statsInterpretation: { type: "string" },
      activityInterpretation: { type: "string" },
      languageInterpretation: { type: "string" },
      topRepos: {
        type: "array",
        minItems: 0,
        maxItems: 6,
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            codeQuality: {
              type: "string",
              enum: ["Excellent", "Good", "Mixed", "Weak", "Unknown"],
            },
            testing: {
              type: "string",
              enum: ["Strong", "Some", "None", "Unknown"],
            },
            cicd: {
              type: "string",
              enum: ["Present", "Partial", "None", "Unknown"],
            },
            verdict: {
              type: "string",
              enum: ["Standout", "Strong", "Solid", "Needs Work", "Risky"],
            },
            isBestWork: { type: "boolean" },
          },
          required: ["name", "codeQuality", "testing", "cicd", "verdict", "isBestWork"],
          additionalProperties: false,
        },
      },
      strengths: {
        type: "array",
        minItems: 3,
        maxItems: 5,
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
        minItems: 3,
        maxItems: 5,
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
        minItems: 0,
        maxItems: 4,
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
        minItems: 4,
        maxItems: 6,
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
      dataQualityWarnings: {
        type: "array",
        minItems: 0,
        maxItems: 5,
        items: { type: "string" },
      },
    },
    required: [
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
      "dataQualityWarnings",
    ],
    additionalProperties: false,
  },
} as const;

const CANONICAL_AXES = [
  "Code Quality",
  "Project Complexity",
  "Technical Breadth",
  "Eng. Practices",
  "Consistency",
  "Collaboration",
] as const;

/** Re-order and deduplicate radar arrays to the canonical 6-axis order. */
function normalizeRadar(response: ScorerResponse): ScorerResponse {
  const axisMap = new Map(response.radarAxes.map((a) => [a.axis, a]));
  const breakdownMap = new Map(response.radarBreakdown.map((b) => [b.label, b]));

  response.radarAxes = CANONICAL_AXES.map((axis) =>
    axisMap.get(axis) ?? { axis, value: 0 },
  );
  response.radarBreakdown = CANONICAL_AXES.map((label) =>
    breakdownMap.get(label) ?? { label, note: "" },
  );

  return response;
}

/** Validate topRepos against provided repos and normalize isBestWork. */
function validateTopRepos(response: ScorerResponse, providedRepoNames: string[]): ScorerResponse {
  const nameSet = new Set(providedRepoNames.map((n) => n.toLowerCase()));

  // Filter out hallucinated repo names and deduplicate by normalized name
  const seen = new Set<string>();
  response.topRepos = response.topRepos.filter((r) => {
    const lower = r.name.toLowerCase();
    if (!nameSet.has(lower) || seen.has(lower)) return false;
    seen.add(lower);
    return true;
  });

  // Normalize isBestWork: exactly one true, or none if empty
  if (response.topRepos.length === 0) {
    return response;
  }

  const bestWorkRepos = response.topRepos.filter((r) => r.isBestWork);
  if (bestWorkRepos.length !== 1) {
    // Reset all, then pick the first one (or the one the model chose if exactly one survived filtering)
    for (const r of response.topRepos) {
      r.isBestWork = false;
    }
    if (bestWorkRepos.length > 0) {
      // Keep the first one the model marked
      const kept = response.topRepos.find((r) => bestWorkRepos.some((b) => b.name === r.name));
      if (kept) kept.isBestWork = true;
      else response.topRepos[0].isBestWork = true;
    } else {
      response.topRepos[0].isBestWork = true;
    }
  }

  return response;
}

export async function generateScorerResponse(
  githubData: GitHubUserData,
  signal?: AbortSignal,
): Promise<ScorerResponse> {
  const userMessage = buildUserMessage(
    githubData,
    "Analyze this profile and return the structured JSON assessment.",
  );

  const completion = await getClient().chat.completions.create({
    model: env.openaiModel,
    messages: [
      { role: "system", content: SCORER_PROMPT },
      { role: "user", content: userMessage },
    ],
    response_format: {
      type: "json_schema",
      json_schema: SCORER_SCHEMA,
    },
    temperature: 0,
  }, { signal });

  logTokenUsage("scorer", env.openaiModel, completion.usage);

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned empty response");
  }

  const parsed = normalizeRadar(JSON.parse(content) as ScorerResponse);
  const providedRepoNames = githubData.topRepositories.map((r) => r.name);
  return validateTopRepos(parsed, providedRepoNames);
}

function buildLockedLine(scoring: ScoringResult): string {
  return `LOCKED: score=${scoring.overallScore} level=${scoring.candidateLevel} rec=${scoring.recommendation}`;
}

function buildNarratorMessage(scorer: ScorerResponse, scoring: ScoringResult): string {
  const locked = buildLockedLine(scoring);
  return `
Analysis Data (all numeric values are LOCKED — use them verbatim):

Overall Score: ${scoring.overallScore}
Candidate Level: ${scoring.candidateLevel}
Recommendation: ${scoring.recommendation}
Confidence: ${scoring.confidenceScore}

Radar Scores:
${scorer.radarAxes.map((a) => `- ${a.axis}: ${Math.round(a.value * 10)}/10`).join("\n")}

Top Repos:
${scorer.topRepos.map((r) => `- ${r.name}: ${r.verdict} (Quality: ${r.codeQuality}, Testing: ${r.testing}, CI/CD: ${r.cicd})`).join("\n")}

Strengths:
${scorer.strengths.map((s) => `- ${s.text}: ${s.evidence}`).join("\n")}

Weaknesses:
${scorer.weaknesses.map((w) => `- ${w.text}: ${w.evidence}`).join("\n")}

Red Flags: ${scorer.redFlags.length === 0 ? "None" : scorer.redFlags.map((f) => `${f.text} (${f.severity})`).join(", ")}

Risk Signals: ${scoring.riskSignals.concerningCount} concerning, ${scoring.riskSignals.notableCount} notable

${scorer.statsInterpretation}

End your response with exactly this line:
${locked}
`;
}

function generateFallbackReport(scoring: ScoringResult, scorer: ScorerResponse): string {
  const topRepo = scorer.topRepos.find((r) => r.isBestWork) ?? scorer.topRepos[0];
  const topStrengths = scorer.strengths.slice(0, 2).map((s) => s.text.toLowerCase()).join(" and ");

  // Paragraph 1: Overall assessment (2-3 sentences)
  const p1 = [
    `This developer presents a ${scoring.candidateLevel.toLowerCase()}-level profile based on the repositories and activity available for review.`,
    topRepo
      ? `Their strongest work appears in ${topRepo.name}, which demonstrates ${topRepo.codeQuality.toLowerCase()} code quality and a ${topRepo.verdict.toLowerCase()} overall impression.`
      : `The available repositories provide a limited but informative picture of their engineering approach.`,
  ].join(" ");

  // Paragraph 2: Key strengths (3-5 sentences)
  const p2Parts = [
    topStrengths
      ? `Notable strengths include ${topStrengths}.`
      : `The profile shows solid coding fundamentals.`,
  ];
  if (scorer.strengths.length > 2) {
    p2Parts.push(`Additionally, ${scorer.strengths[2].text.toLowerCase()} is evident from the codebase.`);
  }
  if (topRepo) {
    p2Parts.push(`The ${topRepo.name} project stands out with ${topRepo.testing.toLowerCase()} testing coverage and ${topRepo.cicd.toLowerCase()} CI/CD configuration.`);
  }
  // Ensure at least 3 sentences for narrator contract compliance
  if (p2Parts.length < 3) {
    p2Parts.push(`The coding style reflects attention to structure and readability.`);
  }
  if (p2Parts.length < 3) {
    p2Parts.push(`Overall, the technical profile shows a developer who values practical, working software.`);
  }
  const p2 = p2Parts.join(" ");

  // Paragraph 3: Concerns, confidence, and recommendation (3-5 sentences)
  const p3Parts: string[] = [];
  if (scorer.weaknesses.length > 0) {
    p3Parts.push(`The main area for improvement is ${scorer.weaknesses[0].text.toLowerCase()}.`);
    if (scorer.weaknesses.length > 1) {
      p3Parts.push(`Additionally, ${scorer.weaknesses[1].text.toLowerCase()} warrants attention.`);
    }
  } else {
    p3Parts.push(`No major weaknesses stand out, though there is always room for further growth.`);
  }
  if (scoring.riskSignals.concerningCount > 0) {
    p3Parts.push(`There are ${scoring.riskSignals.concerningCount} concerning risk signal${scoring.riskSignals.concerningCount > 1 ? "s" : ""} worth investigating further.`);
  }
  p3Parts.push(`Confidence in this assessment sits at ${Math.round(scoring.confidenceScore * 100)}%, reflecting the depth of data available.`);
  p3Parts.push(`Based on the evidence reviewed, the overall recommendation is "${scoring.recommendation.toLowerCase()}".`);
  const p3 = p3Parts.join(" ");

  return `${p1}\n\n${p2}\n\n${p3}`;
}

export async function generateNarrativeReport(
  scorer: ScorerResponse,
  scoring: ScoringResult,
  signal?: AbortSignal,
): Promise<string> {
  const narratorMessage = buildNarratorMessage(scorer, scoring);
  const lockedLine = buildLockedLine(scoring);

  async function attempt(temperature: number): Promise<string | null> {
    try {
      const completion = await getClient().chat.completions.create({
        model: env.openaiModel,
        messages: [
          { role: "system", content: NARRATOR_PROMPT },
          { role: "user", content: narratorMessage },
        ],
        temperature,
      }, { signal });

      logTokenUsage("narrator", env.openaiModel, completion.usage);

      const content = completion.choices[0]?.message?.content;
      if (!content) return null;

      // Validate last line matches LOCKED_LINE
      const lines = content.trim().split("\n");
      const lastLine = lines[lines.length - 1].trim();
      if (lastLine !== lockedLine) {
        logger.warn("Narrator LOCKED_LINE mismatch — expected:", lockedLine, "got:", lastLine);
        return null;
      }

      // Strip LOCKED_LINE from returned text
      lines.pop();
      return lines.join("\n").trim();
    } catch (err) {
      logger.error("Narrator call failed:", err);
      return null;
    }
  }

  // Try at 0.5, then retry at 0.2
  let result = await attempt(0.5);
  if (!result) {
    logger.warn("Narrator first attempt failed, retrying at temperature 0.2");
    result = await attempt(0.2);
  }
  if (!result) {
    logger.warn("Narrator second attempt failed, using fallback template");
    return generateFallbackReport(scoring, scorer);
  }

  return result;
}

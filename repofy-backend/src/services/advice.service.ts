import OpenAI from "openai";
import { env } from "../config/env";
import { ADVICE_SYSTEM_PROMPT } from "../lib/prompts";
import { buildUserMessage } from "../lib/build-user-message";
import { logTokenUsage } from "../lib/usage-logger";
import { logger } from "../lib/logger";
import type {
  GitHubUserData,
  AdviceV2,
  AdviceV2Raw,
  AdviceSectionName,
} from "../types";
import { GenerationWarning } from "../types";

const client = new OpenAI({ apiKey: env.openaiApiKey });

// ── Section schemas (building blocks) ────────────────────────────────

const TRAJECTORY_SCHEMA = {
  type: "object",
  properties: {
    currentEstimate: { type: "string", enum: ["Junior", "Mid-Level", "Senior", "Staff"] },
    targetEstimate: { type: "string", enum: ["Junior", "Mid-Level", "Senior", "Staff"] },
    confidence: { type: "string", enum: ["Low", "Medium", "High"] },
    rationale: { type: "string" },
    calibration: {
      type: "object",
      properties: {
        complexity: { type: "string" },
        breadth: { type: "string" },
        collaboration: { type: "string" },
        engineeringPractices: { type: "string" },
        consistency: { type: "string" },
      },
      required: ["complexity", "breadth", "collaboration", "engineeringPractices", "consistency"],
      additionalProperties: false,
    },
  },
  required: ["currentEstimate", "targetEstimate", "confidence", "rationale", "calibration"],
  additionalProperties: false,
} as const;

const BUILD_ROADMAP_ITEM_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    projectOutcome: { type: "string" },
    difficulty: { type: "string", enum: ["Beginner", "Intermediate", "Advanced"] },
    estimatedWeeks: { type: "number" },
    techStack: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 8 },
    milestones: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 6 },
    hiringSignals: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 4 },
    evidence: { type: "string" },
  },
  required: ["title", "projectOutcome", "difficulty", "estimatedWeeks", "techStack", "milestones", "hiringSignals", "evidence"],
  additionalProperties: false,
} as const;

const SKILL_ROADMAP_ITEM_SCHEMA = {
  type: "object",
  properties: {
    skill: { type: "string" },
    priority: { type: "string", enum: ["Now", "Next", "Later"] },
    demandLevel: { type: "string", enum: ["High", "Medium", "Growing"] },
    relatedTo: { type: "string" },
    reason: { type: "string" },
    proofOfLearning: { type: "string" },
    evidence: { type: "string" },
  },
  required: ["skill", "priority", "demandLevel", "relatedTo", "reason", "proofOfLearning", "evidence"],
  additionalProperties: false,
} as const;

const REPO_IMPROVEMENT_SCHEMA = {
  type: "object",
  properties: {
    repoName: { type: "string" },
    improvements: {
      type: "array",
      minItems: 2,
      maxItems: 4,
      items: {
        type: "object",
        properties: {
          area: { type: "string", enum: ["Testing", "Documentation", "CI/CD", "Code Quality", "Architecture"] },
          suggestion: { type: "string" },
          priority: { type: "string", enum: ["High", "Medium", "Low"] },
          expectedOutcome: { type: "string" },
        },
        required: ["area", "suggestion", "priority", "expectedOutcome"],
        additionalProperties: false,
      },
    },
  },
  required: ["repoName", "improvements"],
  additionalProperties: false,
} as const;

const CONTRIBUTION_STRATEGY_ITEM_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    detail: { type: "string" },
    evidence: { type: "string" },
  },
  required: ["title", "detail", "evidence"],
  additionalProperties: false,
} as const;

const PROFILE_OPTIMIZATION_ITEM_SCHEMA = {
  type: "object",
  properties: {
    area: { type: "string" },
    current: { type: "string" },
    suggestion: { type: "string" },
    example: { type: "string" },
    impact: { type: "string" },
  },
  required: ["area", "current", "suggestion", "example", "impact"],
  additionalProperties: false,
} as const;

const WEEKLY_ROADMAP_ITEM_SCHEMA = {
  type: "object",
  properties: {
    week: { type: "number" },
    activeBuildTitle: { type: "string" },
    focus: { type: "string" },
    deliverable: { type: "string" },
    tasks: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 4 },
    skillTask: { type: "string" },
    successCheck: { type: "string" },
  },
  required: ["week", "activeBuildTitle", "focus", "deliverable", "tasks", "skillTask", "successCheck"],
  additionalProperties: false,
} as const;

const STRENGTHS_AND_GAPS_SCHEMA = {
  type: "object",
  properties: {
    strengths: {
      type: "array",
      minItems: 3,
      maxItems: 5,
      items: {
        type: "object",
        properties: {
          area: { type: "string" },
          detail: { type: "string" },
        },
        required: ["area", "detail"],
        additionalProperties: false,
      },
    },
    gaps: {
      type: "array",
      minItems: 3,
      maxItems: 5,
      items: {
        type: "object",
        properties: {
          area: { type: "string" },
          detail: { type: "string" },
        },
        required: ["area", "detail"],
        additionalProperties: false,
      },
    },
  },
  required: ["strengths", "gaps"],
  additionalProperties: false,
} as const;

const CAREER_POSITIONING_SCHEMA = {
  type: "object",
  properties: {
    positioning: { type: "string" },
    roles: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 4 },
    differentiators: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 4 },
  },
  required: ["positioning", "roles", "differentiators"],
  additionalProperties: false,
} as const;

const SECTION_SCHEMAS: Record<AdviceSectionName, unknown> = {
  summary: { type: "string" },
  trajectory: TRAJECTORY_SCHEMA,
  buildRoadmap: { type: "array", items: BUILD_ROADMAP_ITEM_SCHEMA, minItems: 3, maxItems: 3 },
  skillRoadmap: { type: "array", items: SKILL_ROADMAP_ITEM_SCHEMA, minItems: 4, maxItems: 6 },
  repoImprovements: { type: "array", items: REPO_IMPROVEMENT_SCHEMA, minItems: 1, maxItems: 6 },
  contributionStrategy: { type: "array", items: CONTRIBUTION_STRATEGY_ITEM_SCHEMA, minItems: 3, maxItems: 5 },
  profileOptimizations: { type: "array", items: PROFILE_OPTIMIZATION_ITEM_SCHEMA, minItems: 4, maxItems: 6 },
  weeklyRoadmap: { type: "array", items: WEEKLY_ROADMAP_ITEM_SCHEMA, minItems: 12, maxItems: 12 },
  strengthsAndGaps: STRENGTHS_AND_GAPS_SCHEMA,
  careerPositioning: CAREER_POSITIONING_SCHEMA,
  successMetrics: { type: "array", items: { type: "string" }, minItems: 5, maxItems: 8 },
};

// ── Full generation schema ───────────────────────────────────────────

export const ADVICE_V2_JSON_SCHEMA = {
  name: "advice_v2_response",
  strict: true,
  schema: {
    type: "object",
    properties: {
      summary: SECTION_SCHEMAS.summary,
      trajectory: SECTION_SCHEMAS.trajectory,
      buildRoadmap: SECTION_SCHEMAS.buildRoadmap,
      skillRoadmap: SECTION_SCHEMAS.skillRoadmap,
      repoImprovements: SECTION_SCHEMAS.repoImprovements,
      contributionStrategy: SECTION_SCHEMAS.contributionStrategy,
      profileOptimizations: SECTION_SCHEMAS.profileOptimizations,
      weeklyRoadmap: SECTION_SCHEMAS.weeklyRoadmap,
      strengthsAndGaps: SECTION_SCHEMAS.strengthsAndGaps,
      careerPositioning: SECTION_SCHEMAS.careerPositioning,
      successMetrics: SECTION_SCHEMAS.successMetrics,
    },
    required: [
      "summary", "trajectory", "buildRoadmap", "skillRoadmap",
      "repoImprovements", "contributionStrategy", "profileOptimizations",
      "weeklyRoadmap", "strengthsAndGaps", "careerPositioning", "successMetrics",
    ],
    additionalProperties: false,
  },
} as const;

// ── successMetrics measurability validation ──────────────────────────

const WRITTEN_NUMBERS = /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/i;
const DIGIT = /\d+/;
const DELIVERABLE_NOUNS = /\b(PRs?|repos?|projects?|pipelines?|deployments?|apps?|portfolios?|contributions?|commits?|releases?|certificates?|blog\s*posts?)\b/i;
const COMPLETION_VERBS = /\b(ship|deploy|publish|merge|complete|build|launch|earn|write)\b/i;
const TIMEFRAME_MARKERS = /\b(by\s+week|within|by\s+end\s+of|after\s+\d+\s+weeks?|per\s+week|per\s+month|monthly|weekly)\b/i;
const VAGUE_STARTS = /^\s*(improve|get\s+better|learn\s+more|enhance|grow)\b/i;

export function isMetricMeasurable(metric: string): boolean {
  const words = metric.trim().split(/\s+/);
  if (words.length < 8) return false;
  if (VAGUE_STARTS.test(metric)) return false;

  const hasNumber = DIGIT.test(metric) || WRITTEN_NUMBERS.test(metric);
  const hasDeliverable = DELIVERABLE_NOUNS.test(metric);
  const hasCompletionVerb = COMPLETION_VERBS.test(metric);
  const hasTimeframe = TIMEFRAME_MARKERS.test(metric);

  // Hard reject: no qualifying content at all
  if (!hasNumber && !hasDeliverable && !hasTimeframe) return false;

  // Pattern A: numeric target with measurable context
  if (hasNumber && (hasDeliverable || hasTimeframe)) return true;
  // Pattern B: binary deliverable
  if (hasDeliverable && hasCompletionVerb) return true;
  // Pattern C: timeframe-bound outcome
  if (hasTimeframe) return true;

  return false;
}

// ── Section classification ───────────────────────────────────────────

const CRITICAL_SECTIONS: ReadonlySet<AdviceSectionName> = new Set([
  "summary", "buildRoadmap", "trajectory",
]);

// ── Normalization ────────────────────────────────────────────────────

interface ValidationError {
  section: AdviceSectionName;
  message: string;
}

export function normalizeAdvice(
  raw: AdviceV2Raw,
  githubData: GitHubUserData,
): { normalized: AdviceV2Raw; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  const result = { ...raw };

  // Valid repo names from GitHub data
  const validRepoNames = new Set(
    githubData.topRepositories.map((r) => r.name.toLowerCase()),
  );

  // Existing stack (languages + topics) for skill filtering
  const existingStack = new Set<string>();
  for (const lang of githubData.languages) {
    existingStack.add(lang.name.toLowerCase());
  }
  for (const repo of githubData.topRepositories) {
    if (repo.language) existingStack.add(repo.language.toLowerCase());
    for (const topic of repo.topics) {
      existingStack.add(topic.toLowerCase());
    }
  }

  // 1. Filter repoImprovements to real repo names
  if (result.repoImprovements) {
    const before = result.repoImprovements.length;
    result.repoImprovements = result.repoImprovements.filter(
      (r) => validRepoNames.has(r.repoName.toLowerCase()),
    );
    if (result.repoImprovements.length < before) {
      const invalid = raw.repoImprovements
        .filter((r) => !validRepoNames.has(r.repoName.toLowerCase()))
        .map((r) => r.repoName);
      errors.push({
        section: "repoImprovements",
        message: `Referenced repos ${invalid.join(", ")} don't exist. Valid repos: [${[...validRepoNames].join(", ")}]`,
      });
    }
    result.repoImprovements = result.repoImprovements.slice(0, 6);
    // Trim improvements per repo to 2-4
    result.repoImprovements = result.repoImprovements.map((r) => ({
      ...r,
      improvements: r.improvements.slice(0, 4),
    }));
  }

  // 2. Dedupe build titles
  if (result.buildRoadmap) {
    const seen = new Set<string>();
    result.buildRoadmap = result.buildRoadmap.filter((b) => {
      const key = b.title.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    result.buildRoadmap = result.buildRoadmap.slice(0, 3);

    // Validate estimatedWeeks sum
    const sum = result.buildRoadmap.reduce((s, b) => s + b.estimatedWeeks, 0);
    if (sum > 12) {
      errors.push({
        section: "buildRoadmap",
        message: `estimatedWeeks sum is ${sum}, must be <= 12`,
      });
    }

    if (result.buildRoadmap.length !== 3) {
      errors.push({
        section: "buildRoadmap",
        message: `buildRoadmap has ${result.buildRoadmap.length} items after dedup, must be exactly 3`,
      });
    }

    // Validate per-build sub-array minima
    for (const build of result.buildRoadmap) {
      if (build.techStack.length < 3) {
        errors.push({
          section: "buildRoadmap",
          message: `"${build.title}" has ${build.techStack.length} techStack items, minimum 3`,
        });
      }
      if (build.milestones.length < 3) {
        errors.push({
          section: "buildRoadmap",
          message: `"${build.title}" has ${build.milestones.length} milestones, minimum 3`,
        });
      }
      if (build.hiringSignals.length < 2) {
        errors.push({
          section: "buildRoadmap",
          message: `"${build.title}" has ${build.hiringSignals.length} hiringSignals, minimum 2`,
        });
      }
    }
  }

  // 3. Dedupe + filter skillRoadmap
  if (result.skillRoadmap) {
    const seen = new Set<string>();
    result.skillRoadmap = result.skillRoadmap.filter((s) => {
      const key = s.skill.toLowerCase();
      if (seen.has(key)) return false;
      if (existingStack.has(key)) return false;
      seen.add(key);
      return true;
    });
    result.skillRoadmap = result.skillRoadmap.slice(0, 6);
  }

  // 4. Normalize weeklyRoadmap
  if (result.weeklyRoadmap) {
    // Sort by week number and ensure weeks 1-12
    result.weeklyRoadmap = result.weeklyRoadmap
      .sort((a, b) => a.week - b.week)
      .slice(0, 12);

    // Re-number to 1..N
    result.weeklyRoadmap = result.weeklyRoadmap.map((w, i) => ({
      ...w,
      week: i + 1,
      tasks: w.tasks.slice(0, 4),
    }));

    if (result.weeklyRoadmap.length !== 12) {
      errors.push({
        section: "weeklyRoadmap",
        message: `weeklyRoadmap has ${result.weeklyRoadmap.length} entries, must be exactly 12`,
      });
    }

    // Validate activeBuildTitle references
    const buildTitles = new Set(
      (result.buildRoadmap ?? []).map((b) => b.title),
    );
    const invalidWeeks = result.weeklyRoadmap.filter(
      (w) => !buildTitles.has(w.activeBuildTitle),
    );
    if (invalidWeeks.length > 0) {
      errors.push({
        section: "weeklyRoadmap",
        message: `Weeks ${invalidWeeks.map((w) => w.week).join(", ")} reference invalid activeBuildTitle. Valid titles: [${[...buildTitles].join(", ")}]`,
      });
    }

    // Validate build sequence coherence (no random oscillation)
    if (result.buildRoadmap && result.buildRoadmap.length > 0) {
      const titleOrder = result.buildRoadmap.map((b) => b.title);
      let lastIdx = -1;
      let oscillations = 0;
      for (const w of result.weeklyRoadmap) {
        const idx = titleOrder.indexOf(w.activeBuildTitle);
        if (idx >= 0 && idx < lastIdx) oscillations++;
        if (idx >= 0) lastIdx = idx;
      }
      if (oscillations > 1) {
        errors.push({
          section: "weeklyRoadmap",
          message: `Build sequence oscillates ${oscillations} times. Builds should progress in order: ${titleOrder.join(" → ")}`,
        });
      }
    }

    // Validate non-empty skillTask
    const emptySkillWeeks = result.weeklyRoadmap.filter(
      (w) => !w.skillTask || w.skillTask.trim() === "",
    );
    if (emptySkillWeeks.length > 0) {
      errors.push({
        section: "weeklyRoadmap",
        message: `Weeks ${emptySkillWeeks.map((w) => w.week).join(", ")} have empty skillTask`,
      });
    }
  }

  // 5. Validate successMetrics measurability
  if (result.successMetrics) {
    const failing = result.successMetrics.filter((m) => !isMetricMeasurable(m));
    if (failing.length > 0) {
      errors.push({
        section: "successMetrics",
        message: `${failing.length} metrics fail measurability: ${failing.map((m) => `"${m}"`).join("; ")}`,
      });
    }
    result.successMetrics = result.successMetrics.filter(isMetricMeasurable).slice(0, 8);
  }

  // 6. Trim arrays to bounds + enforce minima
  if (result.contributionStrategy) {
    result.contributionStrategy = result.contributionStrategy.slice(0, 5);
    if (result.contributionStrategy.length < 3) {
      errors.push({
        section: "contributionStrategy",
        message: `contributionStrategy has ${result.contributionStrategy.length} items, minimum 3`,
      });
    }
  }
  if (result.profileOptimizations) {
    result.profileOptimizations = result.profileOptimizations.slice(0, 6);
    if (result.profileOptimizations.length < 4) {
      errors.push({
        section: "profileOptimizations",
        message: `profileOptimizations has ${result.profileOptimizations.length} items, minimum 4`,
      });
    }
  }

  return { normalized: result, errors };
}

// ── Degrade logic ────────────────────────────────────────────────────

function synthesizeWeeklyRoadmap(buildRoadmap: AdviceV2Raw["buildRoadmap"]): AdviceV2Raw["weeklyRoadmap"] {
  const weeks: AdviceV2Raw["weeklyRoadmap"] = [];
  let weekNum = 1;
  for (const build of buildRoadmap) {
    const weeksForBuild = Math.min(build.estimatedWeeks || 4, 6);
    for (let i = 0; i < weeksForBuild && weekNum <= 12; i++) {
      const milestone = build.milestones[Math.min(i, build.milestones.length - 1)] ?? "Continue build";
      weeks.push({
        week: weekNum,
        activeBuildTitle: build.title,
        focus: i === 0 ? `Start: ${build.title}` : `Continue: ${build.title}`,
        deliverable: milestone,
        tasks: [milestone, `Work on ${build.title}`],
        skillTask: `Study ${build.techStack[Math.min(i, build.techStack.length - 1)] ?? "core concepts"}`,
        successCheck: `${milestone} completed`,
      });
      weekNum++;
    }
  }
  // Pad to 12 if needed
  while (weeks.length < 12) {
    const lastBuild = buildRoadmap[buildRoadmap.length - 1];
    weeks.push({
      week: weeks.length + 1,
      activeBuildTitle: lastBuild?.title ?? "Build",
      focus: "Polish and finalize",
      deliverable: "Final review and deployment",
      tasks: ["Review all builds", "Deploy final versions"],
      skillTask: "Review and consolidate learnings",
      successCheck: "All builds deployed",
    });
  }
  return weeks.slice(0, 12);
}

const SECTION_DEGRADE_MAP: Partial<Record<AdviceSectionName, {
  degrade: (advice: Partial<AdviceV2Raw>) => unknown;
  warning: GenerationWarning;
}>> = {
  repoImprovements: {
    degrade: () => [],
    warning: GenerationWarning.REPO_IMPROVEMENTS_UNAVAILABLE,
  },
  weeklyRoadmap: {
    degrade: (advice) => synthesizeWeeklyRoadmap(advice.buildRoadmap ?? []),
    warning: GenerationWarning.WEEKLY_ROADMAP_SYNTHESIZED,
  },
  successMetrics: {
    degrade: (advice) => (advice.successMetrics ?? []).filter(isMetricMeasurable).slice(0, 8),
    warning: GenerationWarning.SUCCESS_METRICS_REDUCED,
  },
  profileOptimizations: {
    degrade: (advice) => (advice.profileOptimizations ?? []).slice(0, 3),
    warning: GenerationWarning.PROFILE_OPTIMIZATIONS_REDUCED,
  },
  skillRoadmap: {
    degrade: (advice) => advice.skillRoadmap ?? [],
    warning: GenerationWarning.SKILL_ROADMAP_REDUCED,
  },
  contributionStrategy: {
    degrade: (advice) => (advice.contributionStrategy ?? []).slice(0, 2),
    warning: GenerationWarning.CONTRIBUTION_STRATEGY_REDUCED,
  },
  strengthsAndGaps: {
    degrade: (advice) => advice.strengthsAndGaps ?? { strengths: [], gaps: [] },
    warning: GenerationWarning.STRENGTHS_AND_GAPS_REDUCED,
  },
  careerPositioning: {
    degrade: (advice) => advice.careerPositioning ?? { positioning: "", roles: [], differentiators: [] },
    warning: GenerationWarning.CAREER_POSITIONING_REDUCED,
  },
};

// ── Merge logic ──────────────────────────────────────────────────────

export function mergeAdvice(
  attempt1: Partial<AdviceV2Raw>,
  attempt2: Partial<AdviceV2Raw> | null,
  failedSections: AdviceSectionName[],
  githubData: GitHubUserData,
): { advice: Partial<AdviceV2Raw>; warnings: GenerationWarning[] } {
  const warnings: GenerationWarning[] = [];
  const merged = { ...attempt1 };

  if (!attempt2) {
    // Attempt 2 unparseable — degrade all failed sections
    for (const section of failedSections) {
      const degrader = SECTION_DEGRADE_MAP[section];
      if (degrader) {
        (merged as Record<string, unknown>)[section] = degrader.degrade(merged);
        warnings.push(degrader.warning);
      }
      // Critical sections stay as-is (will fail final validation → 500)
    }
    return { advice: merged, warnings };
  }

  const failedSet = new Set(failedSections);

  for (const key of Object.keys(attempt2) as AdviceSectionName[]) {
    // Only accept keys that were in the failed set
    if (!failedSet.has(key)) continue;

    // Replace with attempt 2 value
    (merged as Record<string, unknown>)[key] = (attempt2 as Record<string, unknown>)[key];
  }

  // Re-validate merged sections
  const { normalized, errors } = normalizeAdvice(merged as AdviceV2Raw, githubData);
  Object.assign(merged, normalized);

  // Degrade any sections that still fail
  const stillFailing = new Set(errors.map((e) => e.section));
  for (const section of stillFailing) {
    const degrader = SECTION_DEGRADE_MAP[section];
    if (degrader) {
      (merged as Record<string, unknown>)[section] = degrader.degrade(merged);
      warnings.push(degrader.warning);
    }
  }

  return { advice: merged, warnings };
}

// ── Dynamic retry schema builder ─────────────────────────────────────

export function buildRetrySchema(failedSections: AdviceSectionName[]) {
  const properties: Record<string, unknown> = {};
  for (const section of failedSections) {
    properties[section] = SECTION_SCHEMAS[section];
  }
  return {
    name: "advice_v2_retry",
    strict: true,
    schema: {
      type: "object",
      properties,
      required: failedSections,
      additionalProperties: false,
    },
  };
}

function buildRetryPrompt(
  errors: ValidationError[],
  validRepoNames: string[],
  buildTitles: string[],
): string {
  const sectionErrors = errors.map(
    (e) => `- ${e.section}: ${e.message}`,
  ).join("\n");

  return `Your previous response had validation errors in the following sections. Regenerate ONLY these sections with the exact same JSON schema.

VALIDATION ERRORS:
${sectionErrors}

ALLOWED VALUES:
- Valid repo names: [${validRepoNames.join(", ")}]
- Valid build titles: [${buildTitles.join(", ")}]

Return a JSON object containing ONLY the failed section keys with corrected values.`;
}

// ── OpenAI call helpers ──────────────────────────────────────────────

async function callOpenAI(
  messages: { role: "system" | "user"; content: string }[],
  schema: { name: string; strict: boolean; schema: Record<string, unknown> },
  maxTokens: number,
  signal?: AbortSignal,
): Promise<string | null> {
  const completion = await client.chat.completions.create({
    model: env.openaiModel,
    messages,
    response_format: {
      type: "json_schema",
      json_schema: schema,
    },
    temperature: 0.4,
    max_completion_tokens: maxTokens,
  }, { signal });

  logTokenUsage("advice", env.openaiModel, completion.usage);

  return completion.choices[0]?.message?.content ?? null;
}

// ── Cardinality warnings (applies to ALL code paths) ─────────────────

function collectCardinalityWarnings(advice: Partial<AdviceV2Raw>): GenerationWarning[] {
  const warnings: GenerationWarning[] = [];
  if ((advice.skillRoadmap?.length ?? 0) < 4) {
    warnings.push(GenerationWarning.SKILL_ROADMAP_REDUCED);
  }
  if ((advice.successMetrics?.length ?? 0) < 5) {
    warnings.push(GenerationWarning.SUCCESS_METRICS_REDUCED);
  }
  return warnings;
}

// ── Main generation pipeline ─────────────────────────────────────────

export async function generateAdvice(
  githubData: GitHubUserData,
  signal?: AbortSignal,
): Promise<AdviceV2> {
  const userMessage = buildUserMessage(
    githubData,
    "Analyze this profile and provide a complete v2 advice plan. Return the structured JSON response.",
  );

  // ── Attempt 1: Full generation ─────────────────────────────────────
  const content = await callOpenAI(
    [
      { role: "system", content: ADVICE_SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    ADVICE_V2_JSON_SCHEMA,
    16384,
    signal,
  );

  if (!content) {
    throw new Error("OpenAI returned empty response");
  }

  const raw = JSON.parse(content) as AdviceV2Raw;
  const { normalized: attempt1, errors } = normalizeAdvice(raw, githubData);

  // If no errors, return clean result (still check cardinality warnings)
  if (errors.length === 0) {
    return {
      schemaVersion: "v2",
      generationWarnings: collectCardinalityWarnings(attempt1),
      ...attempt1,
    };
  }

  // ── Check if only non-critical sections failed ─────────────────────
  const failedSections = [...new Set(errors.map((e) => e.section))];
  const criticalFailures = failedSections.filter((s) => CRITICAL_SECTIONS.has(s));

  // If only non-critical sections failed and they can all be degraded, skip retry
  const nonCriticalOnly = criticalFailures.length === 0;
  const allDegradable = failedSections.every((s) => s in SECTION_DEGRADE_MAP);

  if (nonCriticalOnly && allDegradable) {
    // Check if we should attempt retry or just degrade
    // We always try retry first for better quality
  }

  // ── Attempt 2: Section-level retry ─────────────────────────────────
  logger.info(`Advice retry: sections [${failedSections.join(", ")}] with ${errors.length} errors`);

  const validRepoNames = githubData.topRepositories.map((r) => r.name);
  const buildTitles = (attempt1.buildRoadmap ?? []).map((b) => b.title);
  const retryPrompt = buildRetryPrompt(errors, validRepoNames, buildTitles);
  const retrySchema = buildRetrySchema(failedSections);

  let attempt2: Partial<AdviceV2Raw> | null = null;
  try {
    const retryContent = await callOpenAI(
      [
        { role: "system", content: ADVICE_SYSTEM_PROMPT },
        { role: "user", content: userMessage },
        { role: "user" as const, content: retryPrompt },
      ],
      retrySchema,
      8192,
      signal,
    );
    if (retryContent) {
      attempt2 = JSON.parse(retryContent) as Partial<AdviceV2Raw>;
    }
  } catch (retryErr) {
    logger.warn("Advice retry failed, proceeding with degrade", retryErr);
  }

  // ── Merge ──────────────────────────────────────────────────────────
  const { advice: merged, warnings } = mergeAdvice(
    attempt1, attempt2, failedSections, githubData,
  );

  // ── Final validation — check critical sections ─────────────────────
  const { errors: finalErrors } = normalizeAdvice(merged as AdviceV2Raw, githubData);
  const finalCriticalFailures = finalErrors.filter((e) => CRITICAL_SECTIONS.has(e.section));

  if (finalCriticalFailures.length > 0) {
    throw new Error(
      `Critical advice sections failed after retry: ${finalCriticalFailures.map((e) => `${e.section}: ${e.message}`).join("; ")}`,
    );
  }

  // Add cardinality warnings for reduced sections
  for (const w of collectCardinalityWarnings(merged)) {
    if (!warnings.includes(w)) {
      warnings.push(w);
    }
  }

  return {
    schemaVersion: "v2",
    generationWarnings: warnings,
    ...(merged as AdviceV2Raw),
  };
}

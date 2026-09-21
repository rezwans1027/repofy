import { z } from "zod";
import {
  ContractVersionSchema, ExplanationSchema, KeySchema, RoleIdSchema, ScoreSchema,
  ShortTextSchema, SourceTypeSchema, VersionSchema, uniqueArray,
} from "./primitives";
import { CapabilityDefinitionSchema, RubricRequirementSchema } from "./readiness";

export const CAPABILITY_CATEGORY_IDS = [
  "languages_frameworks", "frontend", "mobile", "backend_api", "data", "architecture", "testing",
  "reliability", "security", "delivery", "observability", "ai_applications", "documentation_collaboration", "provenance",
] as const;
const CategoryIdSchema = z.enum(CAPABILITY_CATEGORY_IDS);
const TextList = z.array(ExplanationSchema).min(1).max(20);
// v1 imports support stable releases only. A new manifest major needs an explicit adapter.
export const RubricVersionSchema = VersionSchema.refine(value => /^1\.(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})$/.test(value), "Unsupported rubric version");
export const ConfidenceLabelSchema = z.enum(["low", "moderate", "high"]);
export const ClaimScopeSchema = z.enum([
  "technology_presence", "configuration_observation", "repository_behavior", "tested_behavior", "contribution_indicator",
]);
export const StrengthPolicySchema = z.strictObject({
  version: z.literal("1.0.0"),
  bands: z.array(z.strictObject({
    key: z.enum(["not_observed", "limited", "moderate", "strong", "very_strong"]),
    label: ShortTextSchema, lowerInclusive: ScoreSchema, upperExclusive: ScoreSchema,
  })).length(5),
  maximumIsInclusive: z.literal(true), presenceOnlyMaximum: z.literal(0.39),
  unknownLabel: z.literal("Not assessable"), unknownHasScore: z.literal(false),
}).refine(value => {
  const boundaries = [0, 0.2, 0.4, 0.65, 0.85, 1];
  const keys = ["not_observed", "limited", "moderate", "strong", "very_strong"];
  return value.bands.every((band, index) => band.key === keys[index] &&
    band.lowerInclusive === boundaries[index] && band.upperExclusive === boundaries[index + 1]);
}, "Strength policy v1 must preserve the PRD bands");

export const ConfidencePolicySchema = z.strictObject({
  version: z.literal("1.0.0"),
  high: z.strictObject({ detectorValidation: z.literal("benchmark_validated"), coverage: z.literal("complete"),
    semanticMatch: z.literal("direct"), independentCorroboration: z.literal(true), provenance: z.literal("bounded") }),
  moderate: z.strictObject({ detectorValidation: z.literal("fixture_validated_or_better"), coverage: z.literal("complete"), semanticMatch: z.literal("direct") }),
  otherwise: z.literal("low"), unsupportedCoverage: z.literal("unknown"),
  numericCalibration: z.literal("deferred_to_run_11"), explanation: ExplanationSchema,
});

export const CapabilityManifestDefinitionSchema = CapabilityDefinitionSchema.extend({
  taxonomyVersion: RubricVersionSchema, groupId: CategoryIdSchema,
  kind: z.enum(["technology_signal", "engineering_behavior", "provenance_signal"]),
  observableBehaviors: TextList, positiveEvidence: TextList, weakEvidence: TextList, limitations: TextList,
  evidenceFamilies: uniqueArray(SourceTypeSchema, 8, 1),
  presencePolicy: z.strictObject({ dependency: z.enum(["limited_observation", "insufficient"]),
    config: z.enum(["limited_observation", "insufficient"]), maximumStrength: z.literal(0.39) }),
  allowedClaimScopes: z.array(z.strictObject({ scope: ClaimScopeSchema, boundary: ExplanationSchema })).min(1).max(5),
  forbiddenClaims: TextList, improvementTemplateIds: uniqueArray(KeySchema, 20, 1),
  detectorCoverage: z.strictObject({ state: z.literal("pending"), plannedRuns: uniqueArray(z.number().int().min(8).max(15), 8, 1), limitation: ExplanationSchema }),
}).superRefine((capability, ctx) => {
  const scopes = capability.allowedClaimScopes.map(item => item.scope);
  if (new Set(scopes).size !== scopes.length) ctx.addIssue({ code: "custom", message: "Duplicate claim scope" });
  if (capability.kind === "technology_signal" && scopes.some(scope => scope !== "technology_presence" && scope !== "configuration_observation")) {
    ctx.addIssue({ code: "custom", message: "Technology signals cannot establish implementation behavior" });
  }
});

export const ImprovementTemplateSchema = z.strictObject({
  templateId: KeySchema, categoryId: CategoryIdSchema, title: ShortTextSchema,
  gapStates: uniqueArray(z.enum(["not_observed", "limited_evidence", "not_assessable"]), 3, 1),
  effort: z.enum(["small", "medium", "large", "unknown"]),
  rationale: ExplanationSchema, projectBehavior: ExplanationSchema,
  expectedEvidence: TextList, acceptanceCriteria: TextList,
});
export const TaxonomyManifestSchema = z.strictObject({
  id: KeySchema, version: RubricVersionSchema,
  categories: z.array(z.strictObject({ categoryId: CategoryIdSchema, label: ShortTextSchema, description: ExplanationSchema })).length(14),
  capabilities: z.array(CapabilityManifestDefinitionSchema).min(14).max(100),
  strengthPolicy: StrengthPolicySchema, confidencePolicy: ConfidencePolicySchema,
  improvementTemplates: z.array(ImprovementTemplateSchema).min(1).max(100),
}).superRefine((taxonomy, ctx) => {
  const check = (valid: boolean, message: string) => { if (!valid) ctx.addIssue({ code: "custom", message }); };
  check(new Set(taxonomy.categories.map(item => item.categoryId)).size === 14, "All fourteen categories are required");
  check(new Set(taxonomy.capabilities.map(item => item.capabilityId)).size === taxonomy.capabilities.length, "Duplicate capability key");
  check(new Set(taxonomy.capabilities.map(item => item.groupId)).size === 14, "Every category needs a capability");
  const templates = new Map(taxonomy.improvementTemplates.map(item => [item.templateId, item]));
  check(templates.size === taxonomy.improvementTemplates.length, "Duplicate improvement key");
  for (const capability of taxonomy.capabilities) {
    check(capability.taxonomyVersion === taxonomy.version, "Capability taxonomy version mismatch");
    check(capability.improvementTemplateIds.every(id => templates.has(id)), "Missing improvement template");
  }
});

export const RequirementEvidencePolicySchema = z.strictObject({
  minimumConfidence: ConfidenceLabelSchema,
  minimumImplementationClusters: z.number().int().min(1).max(10),
  minimumCorroboratingClusters: z.number().int().min(0).max(10),
  corroboratingFamilies: uniqueArray(z.enum(["test", "ci", "docs"]), 3, 1),
  assessability: z.literal("all_capabilities"), presenceOnlyMaximumStrength: z.literal(0.39),
});
// capabilityId is the stable requirement key/anchor retained by Run 02's relational contract.
// capabilityIds names ALL component behaviors; the anchor is included, never a permissive OR.
export const RoleRequirementManifestSchema = RubricRequirementSchema.extend({
  requirementId: KeySchema, version: RubricVersionSchema, label: ShortTextSchema,
  capabilityIds: uniqueArray(KeySchema, 10, 1),
  minimumEvidence: ScoreSchema.min(0.4),
  evidencePolicy: RequirementEvidencePolicySchema,
  aggregation: z.strictObject({ operator: z.literal("all"), strength: z.literal("minimum"), confidence: z.literal("minimum") }),
}).refine(value => value.requirementId === value.capabilityId && value.capabilityIds.includes(value.capabilityId), "Requirement key must match its taxonomy anchor")
  .refine(value => value.minimumEvidence < 0.65 || (value.evidencePolicy.minimumCorroboratingClusters >= 1 &&
    value.evidencePolicy.corroboratingFamilies.every(family => family === "test" || family === "ci")),
  "Strong requirements need independent tests or exercised CI");

export const RoleRubricManifestSchema = z.strictObject({
  contractVersion: ContractVersionSchema, roleId: RoleIdSchema, version: RubricVersionSchema,
  taxonomyId: KeySchema, taxonomyVersion: RubricVersionSchema, name: ShortTextSchema,
  calibration: z.literal("uncalibrated"), weightOrigin: z.enum(["prd_backend_starting_values", "draft_hypothesis"]),
  coveragePolicy: z.strictObject({ denominator: z.literal("all_requirement_weights"),
    unknownRequirements: z.literal("retain_weight_report_separately"), allUnknown: z.literal("unknown_without_score"),
    requiredRequirements: z.literal("report_each_unmet_or_unknown"), disclosure: ExplanationSchema }),
  availability: z.strictObject({ state: z.literal("definitions_only"), externalRollout: z.literal(false),
    plannedCoverage: z.array(z.strictObject({ languages: uniqueArray(KeySchema, 30, 1),
      depth: z.enum(["deep", "baseline", "inventory_only"]), limitation: ExplanationSchema })).min(1).max(10), limitations: TextList }),
  requirements: z.array(RoleRequirementManifestSchema).min(1).max(100),
}).superRefine((rubric, ctx) => {
  if (Math.abs(rubric.requirements.reduce((sum, item) => sum + item.weight, 0) - 1) >= 1e-6 ||
      new Set(rubric.requirements.map(item => item.requirementId)).size !== rubric.requirements.length) {
    ctx.addIssue({ code: "custom", message: "Weights must total one and requirement keys must be unique" });
  }
  if (rubric.requirements.some(item => item.version !== rubric.version)) ctx.addIssue({ code: "custom", message: "Requirement version mismatch" });
  if (rubric.weightOrigin === "prd_backend_starting_values") {
    const backendWeights: Record<string, number> = { api_design: 0.15, data_modeling: 0.15, reliability_recovery: 0.13,
      testing_behavior: 0.12, security_authorization: 0.1, architecture_modularity: 0.1, delivery_automation: 0.08,
      observability_diagnostics: 0.07, performance_resources: 0.05, documentation_operability: 0.05 };
    if (rubric.roleId !== "backend" || rubric.requirements.length !== 10 ||
        rubric.requirements.some(item => backendWeights[item.requirementId] !== item.weight)) {
      ctx.addIssue({ code: "custom", message: "Only the exact backend starting weights are from the PRD" });
    }
  }
});
export const RubricCatalogSchema = z.strictObject({
  contractVersion: ContractVersionSchema, manifestVersion: z.literal("1.0.0"), releaseId: KeySchema,
  taxonomy: TaxonomyManifestSchema, rubrics: z.array(RoleRubricManifestSchema).length(5),
}).superRefine((catalog, ctx) => {
  const check = (valid: boolean, message: string) => { if (!valid) ctx.addIssue({ code: "custom", message }); };
  check(new Set(catalog.rubrics.map(item => item.roleId)).size === 5, "All five distinct roles are required");
  const capabilities = new Map(catalog.taxonomy.capabilities.map(item => [item.capabilityId, item]));
  for (const rubric of catalog.rubrics) {
    check(rubric.taxonomyId === catalog.taxonomy.id && rubric.taxonomyVersion === catalog.taxonomy.version, "Rubric taxonomy mismatch");
    for (const requirement of rubric.requirements) {
      check(requirement.capabilityIds.every(id => capabilities.get(id)?.kind === "engineering_behavior"),
        "Every role component must resolve to an engineering behavior in the recorded taxonomy");
    }
  }
});
export const RubricDiscoveryResponseSchema = RubricCatalogSchema;
export type RubricCatalog = z.infer<typeof RubricCatalogSchema>;
export type TaxonomyManifest = z.infer<typeof TaxonomyManifestSchema>;
export type RoleRubricManifest = z.infer<typeof RoleRubricManifestSchema>;
export type RoleRequirementManifest = z.infer<typeof RoleRequirementManifestSchema>;
export type ConfidenceLabel = z.infer<typeof ConfidenceLabelSchema>;
export type RubricDiscoveryResponse = z.infer<typeof RubricDiscoveryResponseSchema>;

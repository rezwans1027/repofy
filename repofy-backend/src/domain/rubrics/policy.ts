import { z } from "zod";
import {
  ConfidenceLabelSchema, ConfidencePolicySchema, KeySchema, RoleRequirementManifestSchema, ScoreSchema,
  SourceTypeSchema, StrengthPolicySchema, UnknownReasonsSchema,
  type ConfidenceLabel,
} from "@repofy/contracts";

const confidenceOrder = { low: 0, moderate: 1, high: 2 };
const EvidenceSupportSchema = z.strictObject({
  clusterId: KeySchema, sourceType: SourceTypeSchema,
  basis: z.enum(["presence", "implementation", "corroboration"]),
}).refine(item => item.basis !== "implementation" || ["code", "test", "ci"].includes(item.sourceType),
  "Dependencies, configuration, prose and history cannot establish implementation alone");
export const RequirementCapabilityInputSchema = z.discriminatedUnion("state", [
  z.strictObject({ state: z.literal("assessed"), capabilityId: KeySchema, strength: ScoreSchema,
    confidence: ConfidenceLabelSchema, evidence: z.array(EvidenceSupportSchema).min(1).max(100) }),
  z.strictObject({ state: z.literal("not_observed"), capabilityId: KeySchema, confidence: ConfidenceLabelSchema }),
  z.strictObject({ state: z.literal("unknown"), capabilityId: KeySchema, reasons: UnknownReasonsSchema }),
]);
const InputsSchema = z.array(RequirementCapabilityInputSchema).max(100).refine(
  items => new Set(items.map(item => item.capabilityId)).size === items.length, "Duplicate capability input");

/** Reference semantics for Run 11. Inputs must come from validated, deduplicated detector evidence.
 * This does not extract evidence, compute capability strength, or generate a role score. */
export function evaluateRequirement(requirementInput: unknown, capabilityInputs: unknown) {
  const requirement = RoleRequirementManifestSchema.parse(requirementInput);
  const inputs = new Map(InputsSchema.parse(capabilityInputs).map(item => [item.capabilityId, item]));
  const unknownCapabilityIds = requirement.capabilityIds.filter(id => !inputs.has(id) || inputs.get(id)!.state === "unknown");
  if (unknownCapabilityIds.length) return { state: "unknown" as const, unknownCapabilityIds };

  const failures: { capabilityId: string; reasons: string[] }[] = [];
  let strength = 1; let confidence: ConfidenceLabel = "high";
  for (const capabilityId of requirement.capabilityIds) {
    const item = inputs.get(capabilityId)!;
    if (item.state === "unknown") continue; // handled above; keeps the discriminated input type narrow
    const reasons: string[] = [];
    if (confidenceOrder[item.confidence] < confidenceOrder[confidence]) confidence = item.confidence;
    if (item.state === "not_observed") {
      strength = 0;
      reasons.push("not_observed");
    } else {
      const policy = requirement.evidencePolicy;
      const implementation = new Set(item.evidence.filter(evidence => evidence.basis === "implementation").map(evidence => evidence.clusterId));
      const corroboration = new Set(item.evidence.filter(evidence => evidence.basis === "corroboration" &&
        policy.corroboratingFamilies.some(family => family === evidence.sourceType) && !implementation.has(evidence.clusterId))
        .map(evidence => evidence.clusterId));
      const effectiveStrength = implementation.size ? item.strength : Math.min(item.strength, policy.presenceOnlyMaximumStrength);
      strength = Math.min(strength, effectiveStrength);
      if (effectiveStrength < requirement.minimumEvidence) reasons.push("insufficient_strength");
      if (confidenceOrder[item.confidence] < confidenceOrder[policy.minimumConfidence]) reasons.push("insufficient_confidence");
      if (implementation.size < policy.minimumImplementationClusters) reasons.push("implementation_required");
      if (corroboration.size < policy.minimumCorroboratingClusters) reasons.push("independent_corroboration_required");
    }
    if (reasons.length) failures.push({ capabilityId, reasons });
  }
  return { state: failures.length ? "unmet" as const : "satisfied" as const, strength, confidence, failures };
}

export function strengthBand(policyInput: unknown, assessment: { state: "unknown" } | { state: "assessed"; strength: number }) {
  const policy = StrengthPolicySchema.parse(policyInput);
  if (assessment.state === "unknown") return { key: "unknown", label: policy.unknownLabel };
  const value = ScoreSchema.parse(assessment.strength);
  return policy.bands.find(band => value >= band.lowerInclusive && (value < band.upperExclusive || (value === 1 && band.upperExclusive === 1)))!;
}

const ConfidenceFactorsSchema = z.strictObject({
  detectorValidation: z.enum(["unvalidated", "fixture_validated", "benchmark_validated"]),
  coverage: z.enum(["complete", "partial", "unsupported"]), semanticMatch: z.enum(["direct", "indirect"]),
  independentCorroboration: z.boolean(), provenance: z.enum(["bounded", "uncertain"]),
});
export function confidenceLabel(policyInput: unknown, factorsInput: unknown) {
  ConfidencePolicySchema.parse(policyInput);
  const factors = ConfidenceFactorsSchema.parse(factorsInput);
  if (factors.coverage === "unsupported") return { state: "unknown" as const };
  if (factors.coverage !== "complete" || factors.semanticMatch !== "direct" || factors.detectorValidation === "unvalidated") {
    return { state: "assessed" as const, label: "low" as const };
  }
  return { state: "assessed" as const, label: factors.detectorValidation === "benchmark_validated" &&
    factors.independentCorroboration && factors.provenance === "bounded" ? "high" as const : "moderate" as const };
}

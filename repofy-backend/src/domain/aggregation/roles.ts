import { type AggregatedCapability, type AggregatedRole, type RoleRubricManifest, type AggregationSupport } from "@repofy/contracts";
import { evaluateRequirement } from "../rubrics/policy";
import { round } from "./policy";

/** Only a single winning cluster can satisfy a component; do not stitch copies across repositories. */
export function selectedSupport(capability: AggregatedCapability): AggregationSupport[] {
  const selected = capability.trace.clusters.find(c => c.clusterId === capability.trace.selectedClusterId);
  if (!selected) return [];
  return capability.support.filter(s => s.clusterId === selected.clusterId || selected.corroboration.some(c => c.evidenceId === s.evidenceId));
}
export function matchRole(rubric: RoleRubricManifest, capabilities: readonly AggregatedCapability[]): AggregatedRole {
  const byId = new Map(capabilities.map(c => [c.capabilityId, c]));
  const requirements = [...rubric.requirements].sort((a, b) => a.requirementId.localeCompare(b.requirementId)).map(q => {
    const components = q.capabilityIds.map(id => byId.get(id)!);
    const inputs = components.map(c => c.state === "unknown" ? { state: "unknown", capabilityId: c.capabilityId, reasons: ["insufficient_coverage"] }
      : c.state === "not_observed" ? { state: "not_observed", capabilityId: c.capabilityId, confidence: c.confidenceLabel }
      : { state: "assessed", capabilityId: c.capabilityId, strength: c.strength, confidence: c.confidenceLabel,
        // The reference policy needs counts, not thousands of duplicated citations. Thresholds are <=10.
        evidence: [...new Map(selectedSupport(c).map(s => [`${s.clusterId}:${s.basis}`, { clusterId: s.clusterId, sourceType: s.sourceType, basis: s.basis }])).values()].slice(0, 100) });
    const evaluated = evaluateRequirement(q, inputs);
    const satisfaction = evaluated.state === "satisfied" ? evaluated.strength : 0;
    return { requirementId: q.requirementId, capabilityIds: [...q.capabilityIds].sort(), required: q.required, weight: q.weight,
      minimumEvidence: q.minimumEvidence, minimumConfidence: q.evidencePolicy.minimumConfidence, state: evaluated.state,
      strength: evaluated.state === "unknown" ? null : evaluated.strength,
      confidence: evaluated.state === "unknown" ? null : Math.min(...components.map(c => c.confidence!)),
      satisfaction, weightedContribution: round(q.weight * satisfaction),
      assessableFraction: Math.min(...components.map(c => round(c.trace.coverage.reduce((n, s) => n + s.fraction, 0) / c.trace.coverage.length))),
      failures: evaluated.state === "unknown" ? evaluated.unknownCapabilityIds.map(capabilityId => ({ capabilityId, reasons: ["not_assessable" as const] }))
        : evaluated.failures as AggregatedRole["requirements"][number]["failures"] };
  });
  const denominator = round(requirements.reduce((n, q) => n + q.weight, 0));
  const numerator = round(requirements.reduce((n, q) => n + q.weightedContribution, 0));
  const unknownWeight = round(requirements.filter(q => q.state === "unknown").reduce((n, q) => n + q.weight, 0) / denominator);
  const included = capabilities.filter(c => c.state === "assessed" && requirements.some(q => q.capabilityIds.includes(c.capabilityId)));
  const repositories = [...new Set(included.flatMap(c => selectedSupport(c).map(s => s.repositoryId)))].sort().map(repositoryId => {
    const ids = included.filter(c => selectedSupport(c).some(s => s.repositoryId === repositoryId)).map(c => c.capabilityId).sort();
    // Attribution splits each qualified requirement equally over its component winners. Totals equal role coverage.
    const contribution = round(requirements.reduce((n, q) => n + q.weightedContribution * q.capabilityIds.filter(id => ids.includes(id)).length / q.capabilityIds.length, 0) / denominator);
    return { repositoryId, contribution, capabilityIds: ids };
  }).sort((a, b) => b.contribution - a.contribution || a.repositoryId.localeCompare(b.repositoryId));
  return { template: { roleId: rubric.roleId, version: rubric.version }, state: unknownWeight === 1 ? "unknown" : "assessed",
    coverage: unknownWeight === 1 ? null : round(numerator / denominator),
    confidence: unknownWeight === 1 ? null : round(requirements.reduce((n, q) => n + q.weight * (q.confidence ?? 0), 0) / denominator),
    numerator, denominator, unknownWeight,
    assessableFraction: round(requirements.reduce((n, q) => n + q.weight * q.assessableFraction, 0) / denominator), requirements,
    strongestCapabilityIds: included.sort((a, b) => b.strength! - a.strength! || b.confidence! - a.confidence! || a.capabilityId.localeCompare(b.capabilityId)).slice(0, 5).map(c => c.capabilityId),
    gaps: requirements.filter(q => q.state !== "satisfied").map(q => ({ requirementId: q.requirementId,
      state: q.state === "unknown" ? "not_assessable" as const : q.failures.some(f => f.reasons.includes("not_observed")) ? "not_observed" as const : "limited_evidence" as const,
      required: q.required, impact: round(q.weight * (1 - q.satisfaction) / denominator), capabilityIds: q.capabilityIds,
    })).sort((a, b) => b.impact - a.impact || Number(b.required) - Number(a.required) || a.requirementId.localeCompare(b.requirementId)),
    leadingRepositories: repositories, limitations: ["uncalibrated", "partial_coverage", "static_only", "provenance_unknown", "cross_repository_independence_unknown"],
  };
}

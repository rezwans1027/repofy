/** Immutable, deliberately conservative static-evidence policy. ADR 0011 defines every term. */
export const AGGREGATION_POLICY = Object.freeze({
  id: "evidence_aggregation" as const, version: "1.0.0" as const,
  presenceCeiling: 0.39, corroborationBonuses: Object.freeze([0.1, 0.05, 0.025, 0.0125]),
  enabledCorroboratingFamilies: Object.freeze(["test"] as const),
  confidenceSupportBonus: 0.05, confidenceReliability: "minimum_used_observations", decimals: 6, maxEvidence: 20000, maxBytes: 32 * 1024 * 1024,
  crossRepository: "maximum_cluster_no_repository_bonus" as const,
  satisfaction: "minimum_strength_if_all_minima_pass_else_zero" as const,
  provenance: "not_inferred_v1" as const,
});
export const round = (n: number) => Math.round((n + Number.EPSILON) * 1e6) / 1e6;
export function calculateStrength(base: number, presence: boolean, independentFamilies: number) {
  if (!Number.isFinite(base) || base < 0 || base > 1 || !Number.isInteger(independentFamilies) || independentFamilies < 0 || independentFamilies > 4) throw new Error("Invalid strength inputs");
  const ceiling = presence ? AGGREGATION_POLICY.presenceCeiling : 1;
  return round(Math.min(ceiling, base + (presence ? 0 : AGGREGATION_POLICY.corroborationBonuses.slice(0, independentFamilies).reduce((a, b) => a + b, 0))));
}

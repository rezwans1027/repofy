import { z } from "zod";
import { KeySchema, EvidenceIdSchema, GapIdSchema, ScoreSchema, Sha256Schema, uniqueArray } from "./primitives";

// The model selects approved alternatives. It has no prose, score, locator or identity channel.
export const NarrativeSelectionSchema = z.strictObject({
  schemaVersion: z.literal("1.0.0"),
  explanations: z.array(z.strictObject({ capabilityId: KeySchema, statementId: KeySchema,
    evidenceIds: uniqueArray(EvidenceIdSchema, 5, 1), style: z.enum(["observation_first", "limitation_first"]) })).max(100),
  improvements: z.array(z.strictObject({ gapId: GapIdSchema, templateId: KeySchema,
    focus: z.enum(["behavior", "proof"]) })).max(100),
});
export type NarrativeSelection = z.infer<typeof NarrativeSelectionSchema>;
export const NarrativeProvenanceSchema = z.strictObject({
  policy: z.literal("bounded_narrative_1.0.0"), schemaVersion: z.literal("1.0.0"),
  rendering: z.literal("validated_model_selection_deterministic_text"), modelRunId: z.uuid(),
  aggregationInputHash: Sha256Schema, inputHash: Sha256Schema,
  rankingPolicy: z.literal("proof_priority_1.0.0"),
});
export const ImprovementPriorityTraceSchema = z.strictObject({
  roleRelevance: ScoreSchema, gap: ScoreSchema, expectedProof: ScoreSchema, confidence: ScoreSchema,
  effortCost: z.number().min(0.25).max(1), confidenceBasis: z.enum(["assessed_evidence", "unknown"]),
});
// No free text, identifiers, citations, locations, repository counts or provider metadata.
// Future consumers must obtain disclosure authorization separately; this grants no access.
export const GeneralizedNarrativeSchema = z.strictObject({
  projection: z.literal("generalized"), policy: z.literal("bounded_narrative_1.0.0"),
  capabilities: z.array(z.strictObject({ capabilityId: KeySchema,
    state: z.enum(["assessed", "not_observed", "unknown"]), strength: ScoreSchema.nullable(), confidence: ScoreSchema.nullable() })).max(100),
});

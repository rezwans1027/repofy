import { z } from "zod";
import { CountSchema, KeySchema, LimitationsSchema, LineRangeSchema, LocatorIdSchema, VersionReferenceSchema, uniqueArray } from "./primitives";

export const IMPLEMENTATION_KINDS = ["route_service", "request_validation", "authentication_guard", "ownership_guard", "structured_error",
  "form_validation", "request_state", "accessible_action", "parameterized_query", "transaction", "schema_constraint",
  "bounded_retry", "state_guard", "failure_cleanup", "asserted_call", "bounded_model_output"] as const;
export const ImplementationKindSchema = z.enum(IMPLEMENTATION_KINDS);
export const ImplementationSpanSchema = z.strictObject({ lines: LineRangeSchema,
  startColumn: CountSchema.min(1).max(262145), endColumn: CountSchema.min(1).max(262145) })
  .refine(v => v.lines.start !== v.lines.end || v.endColumn >= v.startColumn, "Source columns must be ordered");
export const ImplementationObservationSchema = z.strictObject({
  kind: ImplementationKindSchema,
  confidenceBasis: z.literal("resolved_static_pattern"), calibration: z.literal("uncalibrated"),
  claimBoundary: z.enum(["observed_control", "declared_constraint", "assertion_source"]),
  span: ImplementationSpanSchema,
  // Opaque repository/snapshot-scoped references, never source names or unkeyed content hashes.
  symbolId: LocatorIdSchema, conceptId: LocatorIdSchema, patternId: LocatorIdSchema,
  relations: z.array(z.strictObject({ fileId: LocatorIdSchema, symbolId: LocatorIdSchema, conceptId: LocatorIdSchema,
    lines: LineRangeSchema, relationship: z.enum(["local_call", "asserted_call"]),
    independence: z.enum(["same_source", "separate_test", "mocked_test"]) })).max(20),
  testBoundary: z.enum(["not_a_test", "local_implementation", "mocked_or_intercepted"]),
  limitations: LimitationsSchema.min(1),
}).refine(v => v.kind === "asserted_call" ? v.claimBoundary === "assertion_source" && v.testBoundary !== "not_a_test"
  : v.testBoundary === "not_a_test" && v.claimBoundary === (v.kind === "schema_constraint" ? "declared_constraint" : "observed_control"), "Implementation boundary mismatch");

export function implementationSourceMatches(v: { sourceType: string; detector: { id: string }; structural?: unknown;
  implementation?: z.infer<typeof ImplementationObservationSchema> }) {
  return !v.implementation || (!v.structural && v.detector.id === `tsjs.${v.implementation.kind}`
    && v.sourceType === (v.implementation.kind === "asserted_call" ? "test" : "code"));
}
export const ImplementationCoverageSchema = z.strictObject({
  bundle: VersionReferenceSchema, calibration: z.literal("uncalibrated"), scope: z.literal("bounded_patterns_only"),
  eligibleFiles: CountSchema, analyzedFiles: CountSchema, parseFailures: CountSchema, limitedFiles: CountSchema,
  unsupportedFiles: CountSchema, generatedFiles: CountSchema, noSignalFiles: CountSchema,
  unresolvedImports: CountSchema, dynamicReferences: CountSchema, ambiguousBindings: CountSchema,
  indexedNodes: CountSchema, indexedBytes: CountSchema, aliasConfigurationsRejected: CountSchema,
  evidenceTruncated: z.boolean(), disabledDetectors: uniqueArray(ImplementationKindSchema, IMPLEMENTATION_KINDS.length),
  detectors: z.array(z.strictObject({ kind: ImplementationKindSchema, version: z.enum(["1.0.0", "1.0.1"]),
    capabilityIds: uniqueArray(KeySchema, 4, 1), state: z.enum(["enabled", "quarantined"]), observations: CountSchema })).length(IMPLEMENTATION_KINDS.length),
  limitations: LimitationsSchema.min(1),
}).refine(v => v.eligibleFiles === v.analyzedFiles + v.parseFailures + v.limitedFiles + v.unsupportedFiles + v.generatedFiles
  && v.noSignalFiles <= v.analyzedFiles && new Set(v.detectors.map(d => d.kind)).size === IMPLEMENTATION_KINDS.length
  && v.detectors.every(d => (d.state === "quarantined") === v.disabledDetectors.includes(d.kind)
    && (d.state !== "quarantined" || d.observations === 0)), "Implementation coverage counters mismatch")
  .refine(v => v.bundle.id === "tsjs_implementation" && /^1\.0\.[01](?:-q[01]{16})?$/.test(v.bundle.version)
    && v.detectors.every(d => d.version === v.bundle.version.split("-")[0]), "Implementation coverage versions mismatch");
export type ImplementationObservation = z.infer<typeof ImplementationObservationSchema>;
export type ImplementationCoverage = z.infer<typeof ImplementationCoverageSchema>;
export type ImplementationKind = typeof IMPLEMENTATION_KINDS[number];

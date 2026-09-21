import { z } from "zod";
import { evidenceFields } from "./evidence";
import { structuralSourceMatches } from "./structural";
import { implementationSourceMatches } from "./implementation";
import {
  ExplanationSchema, LineRangeSchema, LocatorIdSchema, Sha256Schema, ShortTextSchema,
  UserId, VersionSchema,
} from "./primitives";
import type { StartAnalysisRequest } from "./api";
import type { ReadinessReportResponse } from "./readiness";

const RelativePathSchema = z.string().min(1).max(1024).refine((path) =>
  !path.startsWith("/") && !/[\\:\x00-\x1f\x7f]/.test(path) && path.split("/").every((part) => part !== ".." && part !== "." && part.length > 0),
"Expected a relative repository path");
export const InternalLocatorSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("file"), path: RelativePathSchema, symbol: ShortTextSchema.optional(), lines: LineRangeSchema.optional() }),
  z.strictObject({ kind: z.literal("provider_metadata"), providerObjectId: z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/),
    commitRelationship: z.enum(["exact_commit", "ancestor", "repository_context"]) }),
]);
export const InternalEvidenceObservationSchema = z.strictObject({
  ...evidenceFields,
  locatorId: LocatorIdSchema,
  locator: InternalLocatorSchema,
  // Keyed fingerprints avoid leaking guessable private content through ordinary hashes.
  fingerprint: z.strictObject({ algorithm: z.literal("hmac-sha256"), keyVersion: VersionSchema, digest: Sha256Schema }),
}).refine(structuralSourceMatches, "Structural observation must match its evidence source")
  .refine(implementationSourceMatches, "Implementation observation must match its evidence source").refine((item) => ["commit", "pull_request", "ci"].includes(item.sourceType)
  ? item.locator.kind === "provider_metadata" || (item.sourceType === "ci" && item.locator.kind === "file")
  : item.locator.kind === "file", "Source type must match its locator");
export type InternalEvidenceObservation = z.infer<typeof InternalEvidenceObservationSchema>;
export type InternalLocator = z.infer<typeof InternalLocatorSchema>;

export const DomainValidationResultSchema = z.discriminatedUnion("valid", [
  z.strictObject({ valid: z.literal(true) }),
  z.strictObject({ valid: z.literal(false), violations: z.array(z.enum([
    "NOT_AUTHORIZED", "ACCESS_REVOKED", "CONSENT_REQUIRED", "FOREIGN_EVIDENCE", "UNSUPPORTED_CLAIM",
    "DISCLOSURE_DENIED", "VERSION_MISMATCH", "INCOMPLETE_ANALYSIS", "QUALITY_BLOCKED",
  ])).min(1).max(20) }),
]);
export type DomainValidationResult = z.infer<typeof DomainValidationResultSchema>;

/**
 * Implement in the backend domain/persistence layer (Run 02 onward). A schema parse is NOT
 * authorization or semantic validation. No permissive default implementation is supplied.
 */
export interface ReadinessDomainValidator {
  /** Verify user -> verified identity -> installation -> active grant -> selected repo + attestation. */
  authorizeSelection(context: { actorUserId: UserId; request: StartAnalysisRequest }): Promise<DomainValidationResult>;
  /**
   * Check ownership and database run/snapshot/evidence membership, exact commits and versions,
   * supported capability/claim scope, sanitized owner labels/text, disclosure, complete analysis,
   * and security/quality gates. Run within the finalization transaction; no TOCTOU authorization.
   */
  validateReport(context: { actorUserId: UserId; report: ReadinessReportResponse }): Promise<DomainValidationResult>;
}

// Future model adapters accept constrained evidence, not archives, tokens or arbitrary source.
export const ModelEvidenceSummarySchema = z.strictObject({
  evidenceId: evidenceFields.evidenceId,
  capabilityIds: evidenceFields.capabilityIds,
  observations: z.array(ExplanationSchema).min(1).max(20),
});
export type ModelEvidenceSummary = z.infer<typeof ModelEvidenceSummarySchema>;

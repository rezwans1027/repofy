import { z } from "zod";

export const CONTRACT_VERSION = "1.0.0" as const;
export const ContractVersionSchema = z.literal(CONTRACT_VERSION);
export const VersionSchema = z.string().max(64).regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[a-zA-Z0-9.-]+)?$/);
export const KeySchema = z.string().min(1).max(100).regex(/^[a-z][a-z0-9_.-]*$/);
export const ShortTextSchema = z.string().trim().min(1).max(240);
export const ExplanationSchema = z.string().trim().min(1).max(2000);
export const TimestampSchema = z.iso.datetime().max(30).regex(/T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/);
export const ScoreSchema = z.number().finite().min(0).max(1);
export const CountSchema = z.number().int().min(0).max(1_000_000_000);
export const GitHubProviderIdSchema = z.string().max(20).regex(/^[1-9]\d*$/);
// GitHub commit objects require a full SHA-1, never a short display SHA.
export const GitHubCommitShaSchema = z.string().regex(/^[a-f0-9]{40}$/);
export const Sha256Schema = z.string().regex(/^sha256:[a-f0-9]{64}$/);
export const RequestIdSchema = z.string().regex(/^[a-zA-Z0-9-]{1,128}$/);
export const IdempotencyKeySchema = z.string().min(8).max(128).regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/);

// UUID storage fits the existing database; brands prevent accidental ID substitution in TS.
export const UserIdSchema = z.uuid().toLowerCase().brand<"UserId">();
export const RepositoryIdSchema = z.uuid().toLowerCase().brand<"RepositoryId">();
export const GitHubAccountIdSchema = z.uuid().toLowerCase().brand<"GitHubAccountId">();
export const InstallationIdSchema = z.uuid().toLowerCase().brand<"InstallationId">();
export const AccessGrantIdSchema = z.uuid().toLowerCase().brand<"AccessGrantId">();
export const AttestationIdSchema = z.uuid().toLowerCase().brand<"AttestationId">();
export const SnapshotIdSchema = z.uuid().toLowerCase().brand<"SnapshotId">();
export const EvidenceIdSchema = z.uuid().toLowerCase().brand<"EvidenceId">();
export const LocatorIdSchema = z.uuid().toLowerCase().brand<"LocatorId">();
export const AnalysisJobIdSchema = z.uuid().toLowerCase().brand<"AnalysisJobId">();
export const AttemptIdSchema = z.uuid().toLowerCase().brand<"AttemptId">();
export const AnalysisRunIdSchema = z.uuid().toLowerCase().brand<"AnalysisRunId">();
export const ReportIdSchema = z.uuid().toLowerCase().brand<"ReportId">();
export const ClaimIdSchema = z.uuid().toLowerCase().brand<"ClaimId">();
export const GapIdSchema = z.uuid().toLowerCase().brand<"GapId">();
export const ImprovementIdSchema = z.uuid().toLowerCase().brand<"ImprovementId">();
export type UserId = z.infer<typeof UserIdSchema>;
export type RepositoryId = z.infer<typeof RepositoryIdSchema>;
export type AnalysisJobId = z.infer<typeof AnalysisJobIdSchema>;
export type AttemptId = z.infer<typeof AttemptIdSchema>;
export type AnalysisRunId = z.infer<typeof AnalysisRunIdSchema>;
export type ReportId = z.infer<typeof ReportIdSchema>;
export type GitHubAccountId = z.infer<typeof GitHubAccountIdSchema>;
export type InstallationId = z.infer<typeof InstallationIdSchema>;
export type AccessGrantId = z.infer<typeof AccessGrantIdSchema>;
export type AttestationId = z.infer<typeof AttestationIdSchema>;
export type SnapshotId = z.infer<typeof SnapshotIdSchema>;
export type EvidenceId = z.infer<typeof EvidenceIdSchema>;
export type LocatorId = z.infer<typeof LocatorIdSchema>;
export type ClaimId = z.infer<typeof ClaimIdSchema>;
export type GapId = z.infer<typeof GapIdSchema>;
export type ImprovementId = z.infer<typeof ImprovementIdSchema>;

export function uniqueArray<T extends z.ZodType>(schema: T, max: number, min = 0) {
  return z.array(schema).min(min).max(max).refine(
    (values) => new Set(values).size === values.length,
    "Duplicate values are not allowed",
  );
}

export const SourceTypeSchema = z.enum(["code", "test", "config", "docs", "commit", "pull_request", "ci", "dependency"]);
export const RepositoryVisibilitySchema = z.enum(["public", "private"]);
export type SourceType = z.infer<typeof SourceTypeSchema>;
export type RepositoryVisibility = z.infer<typeof RepositoryVisibilitySchema>;
export const UnknownReasonSchema = z.enum([
  "unsupported_language", "insufficient_coverage", "no_eligible_files", "access_unavailable",
  "metadata_unavailable", "insufficient_evidence", "security_exclusions", "processing_limit",
]);
export const UnknownReasonsSchema = uniqueArray(UnknownReasonSchema, 8, 1);
export const LimitationsSchema = z.array(ExplanationSchema).max(30);
export const LineRangeSchema = z.strictObject({
  start: z.number().int().min(1).max(10_000_000),
  end: z.number().int().min(1).max(10_000_000),
}).refine((range) => range.end >= range.start, "Line range must be ordered");

export const ROLE_IDS = ["backend", "frontend", "full_stack", "mobile", "ai_application"] as const;
export const RoleIdSchema = z.enum(ROLE_IDS);
export const RoleTemplateReferenceSchema = z.strictObject({ roleId: RoleIdSchema, version: VersionSchema });
export const VersionReferenceSchema = z.strictObject({ id: KeySchema, version: VersionSchema });
export type RoleTemplateReference = z.infer<typeof RoleTemplateReferenceSchema>;
export type VersionReference = z.infer<typeof VersionReferenceSchema>;
export const VersionDependenciesSchema = z.strictObject({
  contract: ContractVersionSchema,
  snapshotIdentity: VersionSchema,
  // Optional only for pre-ingestion legacy fixtures/artifacts. New workers pin the full security policy digest.
  ingestionPolicyHash: Sha256Schema.optional(),
  extractorBundle: VersionReferenceSchema,
  detectorBundle: VersionReferenceSchema,
  coverageManifest: VersionSchema,
  aggregationPolicy: VersionReferenceSchema,
  taxonomy: VersionReferenceSchema,
  roleRubrics: z.array(RoleTemplateReferenceSchema).length(5).refine(
    (roles) => new Set(roles.map((role) => role.roleId)).size === 5,
    "All five distinct roles are required",
  ),
  disclosurePolicy: VersionReferenceSchema,
  synthesis: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("not_used") }),
    z.strictObject({
      kind: z.literal("model"),
      prompt: VersionReferenceSchema,
      model: z.strictObject({ provider: KeySchema, identifier: ShortTextSchema, version: ShortTextSchema }),
    }),
  ]),
});
export type VersionDependencies = z.infer<typeof VersionDependenciesSchema>;

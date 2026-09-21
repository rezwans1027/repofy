import { z } from "zod";
import { AnalyzerCoverageSchema } from "./coverage";
import {
  AnalysisJobIdSchema, AnalysisRunIdSchema, AttemptIdSchema, ContractVersionSchema, CountSchema,
  IdempotencyKeySchema, ReportIdSchema, RepositoryIdSchema, RequestIdSchema,
  RoleTemplateReferenceSchema, ScoreSchema, ShortTextSchema, TimestampSchema, uniqueArray,
} from "./primitives";

export const FeatureFlagsSchema = z.strictObject({
  featureOneEnabled: z.boolean(), githubAppRepositoriesEnabled: z.boolean(),
  rescansEnabled: z.boolean(), findingFeedbackEnabled: z.boolean(),
});
export type FeatureFlags = z.infer<typeof FeatureFlagsSchema>;
export const DISABLED_FEATURE_FLAGS: Readonly<FeatureFlags> = Object.freeze({
  featureOneEnabled: false, githubAppRepositoriesEnabled: false, rescansEnabled: false, findingFeedbackEnabled: false,
});
export const ClientCapabilitiesSchema = z.strictObject({
  contractVersion: ContractVersionSchema,
  features: FeatureFlagsSchema,
  readinessAvailability: z.enum(["disabled", "not_implemented", "available"]),
}).refine((value) => value.features.featureOneEnabled
  ? value.readinessAvailability !== "disabled"
  : value.readinessAvailability === "disabled" && !value.features.githubAppRepositoriesEnabled && !value.features.rescansEnabled && !value.features.findingFeedbackEnabled,
"Capabilities must respect the master feature flag");
export type ClientCapabilities = z.infer<typeof ClientCapabilitiesSchema>;
export const DISABLED_CLIENT_CAPABILITIES: ClientCapabilities = {
  contractVersion: "1.0.0", features: DISABLED_FEATURE_FLAGS, readinessAvailability: "disabled",
};
export const ERROR_CODES = [
  "FEATURE_DISABLED", "FEATURE_NOT_IMPLEMENTED", "INVALID_REQUEST", "UNAUTHENTICATED", "FORBIDDEN",
  "NOT_FOUND", "INTERNAL_ERROR", "IDEMPOTENCY_CONFLICT", "REPOSITORY_ACCESS_REVOKED", "REPOSITORY_TOO_LARGE",
  "UNSUPPORTED_ARCHIVE", "SECRET_SCAN_BLOCKED_CONTENT", "ANALYSIS_ALREADY_RUNNING", "ANALYSIS_VALIDATION_FAILED",
  "INSUFFICIENT_EVIDENCE", "CONSENT_REQUIRED", "PRIVATE_DISCLOSURE_DENIED", "RATE_LIMITED",
  "DATABASE_FAILURE", "PROVIDER_FAILURE", "LEASE_LOST", "WORKER_EXPIRED", "MODEL_OUTCOME_UNKNOWN", "RETRY_NOT_ALLOWED", "ANALYSIS_EXPIRED",
] as const;
export const ErrorCodeSchema = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;
export const ApiErrorEnvelopeSchema = z.strictObject({
  success: z.literal(false), error: ShortTextSchema, code: ErrorCodeSchema,
  retryable: z.boolean(), requestId: RequestIdSchema,
});
export type ApiErrorEnvelope = z.infer<typeof ApiErrorEnvelopeSchema>;
export const MetadataOptionsSchema = z.strictObject({
  commits: z.boolean().default(false), pullRequests: z.boolean().default(false), ci: z.boolean().default(false),
});
export const StartAnalysisRequestSchema = z.strictObject({
  contractVersion: ContractVersionSchema,
  repositoryIds: uniqueArray(RepositoryIdSchema, 10, 1),
  targetRoleTemplate: RoleTemplateReferenceSchema.optional(),
  includeMetadata: MetadataOptionsSchema.default({ commits: false, pullRequests: false, ci: false }),
  idempotencyKey: IdempotencyKeySchema,
  failurePolicy: z.literal("fail_all_v1").default("fail_all_v1"),
});
export type StartAnalysisRequest = z.infer<typeof StartAnalysisRequestSchema>;

export const AnalysisStageSchema = z.enum([
  "queued", "acquiring_access", "downloading", "inventorying", "extracting", "aggregating", "synthesizing", "validating", "completed",
  "authorization", "snapshot", "security_filtering", "inventory", "extraction", "metadata", "aggregation",
  "role_mapping", "synthesis", "validation", "publication", "cleanup",
]);
export const AnalysisProgressSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("indeterminate"), stage: AnalysisStageSchema }),
  z.strictObject({ kind: z.literal("measured"), stage: AnalysisStageSchema, completedUnits: CountSchema, totalUnits: CountSchema.min(1), fraction: ScoreSchema })
    .refine((value) => value.completedUnits <= value.totalUnits && Math.abs(value.fraction - value.completedUnits / value.totalUnits) < 1e-6,
    "Progress must match completed units"),
]);
export const AttemptSummarySchema = z.strictObject({
  attemptId: AttemptIdSchema, number: z.number().int().min(1).max(1000), startedAt: TimestampSchema,
});
const jobFields = {
  contractVersion: ContractVersionSchema, jobId: AnalysisJobIdSchema,
  stage: AnalysisStageSchema,
  createdAt: TimestampSchema, updatedAt: TimestampSchema,
  coverage: z.array(AnalyzerCoverageSchema).max(10).optional(),
};
export const AnalysisJobResponseSchema = z.discriminatedUnion("status", [
  z.strictObject({ ...jobFields, status: z.literal("queued"), attempt: AttemptSummarySchema.nullable(), progress: AnalysisProgressSchema }),
  z.strictObject({ ...jobFields, status: z.literal("running"), attempt: AttemptSummarySchema, analysisRunId: AnalysisRunIdSchema.nullable(), progress: AnalysisProgressSchema }),
  z.strictObject({ ...jobFields, status: z.literal("completed"), attempt: AttemptSummarySchema, finishedAt: TimestampSchema,
    report: z.strictObject({ reportId: ReportIdSchema, analysisRunId: AnalysisRunIdSchema }) }),
  z.strictObject({ ...jobFields, status: z.literal("failed"), attempt: AttemptSummarySchema.nullable(), finishedAt: TimestampSchema,
    failureCode: ErrorCodeSchema, retryable: z.boolean() }),
  z.strictObject({ ...jobFields, status: z.literal("canceled"), attempt: AttemptSummarySchema.nullable(), finishedAt: TimestampSchema }),
  z.strictObject({ ...jobFields, status: z.literal("expired"), attempt: AttemptSummarySchema.nullable(), finishedAt: TimestampSchema }),
]).refine((job) => Date.parse(job.updatedAt) >= Date.parse(job.createdAt) &&
  (!("progress" in job) || job.progress.stage === job.stage) &&
  (!job.attempt || (Date.parse(job.attempt.startedAt) >= Date.parse(job.createdAt) && Date.parse(job.attempt.startedAt) <= Date.parse(job.updatedAt))) &&
  (!("finishedAt" in job) || (Date.parse(job.finishedAt) >= Date.parse(job.createdAt) && Date.parse(job.finishedAt) <= Date.parse(job.updatedAt))),
"Job timestamps must be ordered and progress must match the job stage");
export type AnalysisProgress = z.infer<typeof AnalysisProgressSchema>;
export type AnalysisStage = z.infer<typeof AnalysisStageSchema>;
export type AttemptSummary = z.infer<typeof AttemptSummarySchema>;
export type MetadataOptions = z.infer<typeof MetadataOptionsSchema>;
export type AnalysisJobResponse = z.infer<typeof AnalysisJobResponseSchema>;

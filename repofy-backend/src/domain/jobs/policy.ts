import { z } from "zod";
import { VersionDependenciesSchema } from "@repofy/contracts";
import { SecurityPolicySchema, policyHash } from "../ingestion/policy";

export const ExecutionPolicySchema = z.strictObject({
  workflow: z.literal("durable-analysis-1.0.0"), failurePolicy: z.literal("fail_all_v1"),
  versions: VersionDependenciesSchema, security: SecurityPolicySchema,
  billing: z.enum(["internal_free_v1", "test_units_v1"]),
}).refine(p => p.versions.ingestionPolicyHash === policyHash(p.security), "Security policy must match frozen versions");
export type ExecutionPolicy = z.infer<typeof ExecutionPolicySchema>;
export const WORK_STAGES = ["acquiring_access", "downloading", "inventorying", "extracting", "aggregating", "synthesizing", "validating"] as const;
export type WorkStage = typeof WORK_STAGES[number];
export const JOB_CODES = ["INVALID_REQUEST", "NOT_FOUND", "IDEMPOTENCY_CONFLICT", "REPOSITORY_ACCESS_REVOKED", "CONSENT_REQUIRED",
  "FEATURE_NOT_IMPLEMENTED", "FORBIDDEN", "ANALYSIS_ALREADY_RUNNING", "DATABASE_FAILURE", "PROVIDER_FAILURE", "LEASE_LOST",
  "WORKER_EXPIRED", "MODEL_OUTCOME_UNKNOWN", "RETRY_NOT_ALLOWED", "ANALYSIS_VALIDATION_FAILED", "ANALYSIS_EXPIRED",
  "REPOSITORY_TOO_LARGE", "UNSUPPORTED_ARCHIVE", "SECRET_SCAN_BLOCKED_CONTENT"] as const;
export type JobCode = typeof JOB_CODES[number];
export class JobError extends Error {
  constructor(readonly code: JobCode) { super(code); this.name = "JobError"; }
}
export function jobError(error: unknown): JobError {
  const code = error instanceof Error && "code" in error ? error.code : undefined;
  if (code === "ACCESS_REVOKED") return new JobError("REPOSITORY_ACCESS_REVOKED");
  if (code === "ARCHIVE_LIMIT" || code === "CONTEXT_LIMIT") return new JobError("REPOSITORY_TOO_LARGE");
  if (["ARCHIVE_INVALID", "UNSAFE_PATH", "UNSAFE_ENTRY", "INVALID_IGNORE", "UNSAFE_REDIRECT"].includes(code as string)) return new JobError("UNSUPPORTED_ARCHIVE");
  if (code === "SCANNER_FAILURE") return new JobError("SECRET_SCAN_BLOCKED_CONTENT");
  if (code === "TIMED_OUT") return new JobError("PROVIDER_FAILURE");
  if (JOB_CODES.includes(code as JobCode)) return new JobError(code as JobCode);
  return new JobError("ANALYSIS_VALIDATION_FAILED");
}

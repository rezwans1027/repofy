import { createHash } from "node:crypto";
import { z } from "zod";

const MiB = 1024 * 1024;
/** Deployment configuration only. Browser/repository inputs cannot raise these ceilings. */
export const IngestionLimitsSchema = z.strictObject({
  compressedBytes: z.number().int().min(1024).max(100 * MiB).default(100 * MiB),
  decompressedBytes: z.number().int().min(1024).max(512 * MiB).default(512 * MiB),
  archiveEntries: z.number().int().min(1).max(50000).default(50000),
  eligibleFiles: z.number().int().min(1).max(10000).default(10000),
  fileBytes: z.number().int().min(1).max(MiB).default(MiB),
  contextBytes: z.number().int().min(1).max(32 * MiB).default(32 * MiB),
  totalLines: z.number().int().min(1).max(250000).default(250000),
  pathBytes: z.number().int().min(16).max(1024).default(1024),
  pathDepth: z.number().int().min(2).max(32).default(32),
  prepareTimeoutMs: z.number().int().min(50).max(120000).default(120000),
});
export type IngestionLimits = z.infer<typeof IngestionLimitsSchema>;
export const SecurityPolicySchema = z.strictObject({
  version: z.enum(["1.0.0", "1.1.0"]), scanner: z.literal("repofy-static-secrets-1.0.0"),
  exclusions: z.enum(["repofy-exclusions-1.0.0", "repofy-exclusions-1.1.0"]), ignore: z.literal("ignore-7.0.9-subset-1.0.0"),
  parser: z.literal("tar-7.5.22-guards-1.0.0"), coverage: z.literal("utf8-static-1.0.0"),
  limits: IngestionLimitsSchema,
}).refine(p => p.exclusions === `repofy-exclusions-${p.version}`);
export type SecurityPolicy = z.infer<typeof SecurityPolicySchema>;
export function securityPolicy(limits: Partial<IngestionLimits> = {}): Readonly<SecurityPolicy> {
  const policy = SecurityPolicySchema.parse({ version: "1.0.0", scanner: "repofy-static-secrets-1.0.0",
    exclusions: "repofy-exclusions-1.0.0", ignore: "ignore-7.0.9-subset-1.0.0", parser: "tar-7.5.22-guards-1.0.0",
    coverage: "utf8-static-1.0.0", limits });
  Object.freeze(policy.limits); return Object.freeze(policy);
}
/** Explicit opt-in for new structural runs; old pinned jobs retain v1.0 behavior. */
export function structuralSecurityPolicy(limits: Partial<IngestionLimits> = {}): Readonly<SecurityPolicy> {
  const policy = SecurityPolicySchema.parse({ ...securityPolicy(limits), version: "1.1.0", exclusions: "repofy-exclusions-1.1.0" });
  Object.freeze(policy.limits); return Object.freeze(policy);
}
export function policyHash(policy: SecurityPolicy): string {
  // Schema construction gives deterministic key order, including every effective limit.
  return `sha256:${createHash("sha256").update(JSON.stringify(SecurityPolicySchema.parse(policy))).digest("hex")}`;
}
export const MAX_WORKSPACE_AGE_MS = 30 * 60 * 1000;
export const LEASE_MS = 60000;
export const ACCESS_POLL_MS = 2000;
export const EXCLUSION_REASONS = ["sensitive_path", "dependency", "generated", "binary", "oversized", "unsupported_encoding", "user_ignored", "policy_file", "secret_or_sensitive_data"] as const;
export type ExclusionReason = typeof EXCLUSION_REASONS[number];
export const ScanSummarySchema = z.strictObject({
  archiveEntries: z.number().int().nonnegative().max(50000), totalFiles: z.number().int().nonnegative().max(50000),
  eligibleFiles: z.number().int().nonnegative().max(10000), textBytes: z.number().int().nonnegative().max(32 * MiB),
  totalLines: z.number().int().nonnegative().max(250000), decompressedBytes: z.number().int().nonnegative().max(512 * MiB),
  excluded: z.record(z.enum(EXCLUSION_REASONS), z.number().int().nonnegative().max(50000)),
  scope: z.enum(["filtered", "all_text"]), semanticAnalysis: z.literal("not_performed"),
}).refine(s => s.totalFiles === s.eligibleFiles + Object.values(s.excluded).reduce((a, b) => a + b, 0)
  && s.eligibleFiles <= s.archiveEntries && (s.scope === "all_text") === (s.totalFiles === s.eligibleFiles));
export type ScanSummary = z.infer<typeof ScanSummarySchema>;

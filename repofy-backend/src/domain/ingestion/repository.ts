import { z } from "zod";
import { GitHubCommitShaSchema, GitHubProviderIdSchema, Sha256Schema, VersionSchema } from "@repofy/contracts";
import { InternalLocatorSchema } from "@repofy/contracts/internal";
import type { FeatureOneRpcClient } from "../analysis/persistence";
import type { LocatorCrypto } from "../evidence/locator-crypto";
import { BranchSchema } from "../github-app/provider";
import { bounded, IngestionError, INGESTION_CODES } from "./errors";
import { ScanSummarySchema, SecurityPolicySchema, policyHash, type ScanSummary, type SecurityPolicy } from "./policy";

export const IngestionRequestSchema = z.strictObject({ actor: z.uuid(), jobId: z.uuid(), repositoryId: z.uuid() });
export type IngestionRequest = z.infer<typeof IngestionRequestSchema>;
const accessSchema = z.strictObject({ accountId: z.uuid(), installationId: z.uuid(), grantId: z.uuid(), accessRevision: z.uuid(),
  providerRepositoryId: GitHubProviderIdSchema, repositoryVisibility: z.enum(["private", "public"]) });
export type IngestionAccess = z.infer<typeof accessSchema>;
const pinSchema = z.strictObject({ pinId: z.uuid(), jobId: z.uuid(), repositoryId: z.uuid(), ...accessSchema.shape,
  branch: BranchSchema, commitSha: GitHubCommitShaSchema, resolvedAt: z.iso.datetime({ offset: true }),
  policy: SecurityPolicySchema, policyHash: Sha256Schema });
export type PinnedSnapshot = z.infer<typeof pinSchema>;
const encryptedPinSchema = pinSchema.omit({ branch: true }).extend({ branchEncrypted: z.string().min(1).max(8192) });
export const SafeFileSchema = z.strictObject({ locatorId: z.uuid(), locator: InternalLocatorSchema.refine(l => l.kind === "file"),
  sizeBytes: z.number().int().nonnegative().max(1048576), lines: z.number().int().nonnegative().max(250000),
  contentHash: Sha256Schema, contentHashKeyVersion: VersionSchema });
export type SafeFile = z.infer<typeof SafeFileSchema>;
export interface IngestionStore {
  access(request: IngestionRequest): Promise<IngestionAccess>;
  readPin(request: IngestionRequest): Promise<PinnedSnapshot | null>;
  pin(request: IngestionRequest, pin: PinnedSnapshot): Promise<PinnedSnapshot>;
  begin(actor: string, pinId: string, attemptId: string): Promise<string>;
  checkpoint(actor: string, attemptId: string, leaseToken: string): Promise<void>;
  ready(actor: string, attemptId: string, leaseToken: string, pin: PinnedSnapshot, summary: ScanSummary, files: SafeFile[]): Promise<void>;
  dispose(actor: string, attemptId: string, leaseToken: string): Promise<void>;
  claimExpired(attemptId: string): Promise<boolean>;
}
export class IngestionRepository implements IngestionStore {
  constructor(private readonly db: FeatureOneRpcClient, private readonly crypto: LocatorCrypto) {}
  private async call(name: string, args: Record<string, unknown>) {
    let result;
    try { result = await bounded(this.db.rpc(`feature_one_ingestion_${name}`, args), 5000, "DATABASE_FAILURE"); } catch { throw new IngestionError("DATABASE_FAILURE"); }
    if (result.error) throw new IngestionError(INGESTION_CODES.includes(result.error.message as never) ? result.error.message as typeof INGESTION_CODES[number] : "DATABASE_FAILURE");
    return result.data;
  }
  private args(request: IngestionRequest) { const r = IngestionRequestSchema.parse(request); return { p_actor: r.actor, p_job: r.jobId, p_repository: r.repositoryId }; }
  private decode(value: unknown): PinnedSnapshot {
    try {
      const { branchEncrypted, ...pin } = encryptedPinSchema.parse(value);
      if (policyHash(pin.policy) !== pin.policyHash) throw new Error();
      return pinSchema.parse({ ...pin, branch: this.crypto.decryptBranch(branchEncrypted,
        { repositoryId: pin.repositoryId, snapshotId: pin.pinId, locatorId: pin.pinId }) });
    } catch { throw new IngestionError("POLICY_MISMATCH"); }
  }
  async access(request: IngestionRequest) { return accessSchema.parse(await this.call("access", this.args(request))); }
  async readPin(request: IngestionRequest) { const pin = await this.call("read", this.args(request)); return pin === null ? null : this.decode(pin); }
  async pin(request: IngestionRequest, input: PinnedSnapshot) {
    const { branch, ...pin } = pinSchema.parse(input);
    requireMatchingPolicy(input, input.policy);
    return this.decode(await this.call("pin", { ...this.args(request), p_pin: { ...pin,
      branchEncrypted: this.crypto.encryptBranch(branch, { repositoryId: pin.repositoryId, snapshotId: pin.pinId, locatorId: pin.pinId }) } }));
  }
  async begin(actor: string, pinId: string, attemptId: string) {
    return z.uuid().parse(await this.call("begin", { p_actor: actor, p_pin: pinId, p_attempt: attemptId }));
  }
  async checkpoint(actor: string, attemptId: string, leaseToken: string) {
    await this.call("checkpoint", { p_actor: actor, p_attempt: attemptId, p_token: leaseToken });
  }
  async ready(actor: string, attemptId: string, leaseToken: string, pin: PinnedSnapshot, summary: ScanSummary, input: SafeFile[]) {
    const files = z.array(SafeFileSchema).max(10000).parse(input).map(({ locator, contentHash, contentHashKeyVersion, ...file }) => ({
      ...file, contentHash, contentHashKeyVersion,
      ...this.crypto.protectLocator(locator, { repositoryId: pin.repositoryId, snapshotId: pin.pinId, locatorId: file.locatorId }),
    }));
    await this.call("ready", { p_actor: actor, p_attempt: attemptId, p_token: leaseToken, p_summary: ScanSummarySchema.parse(summary), p_files: files });
  }
  async dispose(actor: string, attemptId: string, leaseToken: string) { await this.call("dispose", { p_actor: actor, p_attempt: attemptId, p_token: leaseToken }); }
  async claimExpired(attemptId: string) { return z.boolean().parse(await this.call("claim_expired", { p_attempt: attemptId })); }
}

export function requireMatchingPolicy(pin: PinnedSnapshot, policy: SecurityPolicy) {
  if (pin.policyHash !== policyHash(policy)) throw new IngestionError("POLICY_MISMATCH");
}

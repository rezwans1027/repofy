import { z } from "zod";
import { GitHubAccountSummarySchema, GitHubProviderIdSchema, TimestampSchema, UserIdSchema } from "@repofy/contracts";
import type { FeatureOneRpcClient } from "../analysis/persistence";
import { GitHubAppError, type GitHubErrorCode } from "./errors";
import { ProviderInstallationSchema, type ProviderInstallation } from "./provider";

const uuid = z.uuid();
const cipher = z.string().max(16000).regex(/^g1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]+$/);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const StoredCredentialSchema = z.strictObject({ accountId: uuid, providerUserId: GitHubProviderIdSchema,
  login: z.string().min(1).max(100), encrypted: cipher, expiresAt: TimestampSchema, revision: uuid });
const connectionSchema = z.strictObject({ providerInstallationId: GitHubProviderIdSchema, providerOwnerId: GitHubProviderIdSchema, ownerType: z.enum(["User", "Organization"]) });
const discoveredSchema = z.strictObject({ id: GitHubProviderIdSchema, providerOwnerId: GitHubProviderIdSchema, visibility: z.enum(["public", "private"]), locatorEncrypted: cipher });
const storedRepositorySchema = z.strictObject({ providerRepositoryId: GitHubProviderIdSchema, providerOwnerId: GitHubProviderIdSchema, locatorEncrypted: cipher });
function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input); if (!result.success) throw new GitHubAppError("invalid_request"); return result.data;
}
export class GitHubConnectionRepository {
  constructor(private readonly db: FeatureOneRpcClient) {}
  private async call(name: string, actor: string, args: Record<string, unknown> = {}) {
    parse(UserIdSchema, actor);
    try {
      const { data, error } = await this.db.rpc(`feature_one_github_${name}`, { p_actor: actor, ...args });
      if (error) {
        const codes: Record<string, GitHubErrorCode> = { INVALID_STATE: "invalid_state", NOT_FOUND: "not_found", IDENTITY_CONFLICT: "identity_conflict",
          INVALID_REQUEST: "invalid_request", RECONNECT_REQUIRED: "reconnect_required", ACCESS_CHANGED: "access_changed" };
        throw new GitHubAppError(codes[error.message ?? ""] ?? "database_failure");
      }
      return data;
    } catch (error) { if (error instanceof GitHubAppError) throw error; throw new GitHubAppError("database_failure"); }
  }
  async activeSession(actor: string, sessionId: string) { return parse(z.boolean(), await this.call("active_session", actor, { p_session: parse(uuid, sessionId) })); }
  async startState(actor: string, stateHash: string, binding: string, stage: "authorize" | "install", payload: string, expires: string, sessionId: string) {
    await this.call("start_state", actor, { p_hash: parse(hash, stateHash), p_binding: parse(hash, binding),
      p_stage: parse(z.enum(["authorize", "install"]), stage), p_payload: parse(cipher, payload), p_expires: parse(TimestampSchema, expires), p_session: parse(uuid, sessionId) });
  }
  async consumeState(actor: string, stateHash: string, binding: string, stage: "authorize" | "install") {
    return parse(cipher, await this.call("consume_state", actor, { p_hash: parse(hash, stateHash), p_binding: parse(hash, binding), p_stage: parse(z.enum(["authorize", "install"]), stage) }));
  }
  async link(actor: string, provider: string, login: string, encrypted: string, expires: string, stateHash: string) {
    return parse(uuid, await this.call("link", actor, { p_provider: parse(GitHubProviderIdSchema, provider), p_login: parse(z.string().min(1).max(100), login), p_token: parse(cipher, encrypted), p_expires: parse(TimestampSchema, expires), p_state_hash: parse(hash, stateHash) }));
  }
  async accounts(actor: string) { return parse(z.array(GitHubAccountSummarySchema).max(20), await this.call("accounts", actor)); }
  async identity(actor: string, account: string) {
    const result = await this.call("identity", actor, { p_account: parse(uuid, account) });
    if (result === null) throw new GitHubAppError("not_found");
    return parse(z.strictObject({ providerUserId: GitHubProviderIdSchema }), result);
  }
  async credential(actor: string, account: string) {
    const result = await this.call("credential", actor, { p_account: parse(uuid, account) });
    if (result === null) throw new GitHubAppError("reconnect_required");
    return parse(StoredCredentialSchema, result);
  }
  async associate(actor: string, account: string, revision: string, facts: ProviderInstallation) {
    return parse(uuid, await this.call("associate", actor, { p_account: parse(uuid, account), p_revision: parse(uuid, revision), p_facts: parse(ProviderInstallationSchema, facts) }));
  }
  async connection(actor: string, account: string, installation: string) {
    const result = await this.call("connection", actor, { p_account: parse(uuid, account), p_installation: parse(uuid, installation) });
    if (result === null) throw new GitHubAppError("not_found");
    return parse(connectionSchema, result);
  }
  async markMissing(actor: string, account: string, revision: string, installation: string) {
    await this.call("mark_missing", actor, { p_account: parse(uuid, account), p_revision: parse(uuid, revision), p_installation: parse(uuid, installation) });
  }
  async discover(actor: string, account: string, revision: string, installation: string, repositories: z.infer<typeof discoveredSchema>[]) {
    return parse(z.array(z.strictObject({ providerRepositoryId: GitHubProviderIdSchema, repositoryId: uuid })).max(100),
      await this.call("discover", actor, { p_account: parse(uuid, account), p_revision: parse(uuid, revision), p_installation: parse(uuid, installation), p_repositories: parse(z.array(discoveredSchema).max(100), repositories) }));
  }
  async repository(actor: string, account: string, installation: string, repository: string) {
    const result = await this.call("repository", actor, { p_account: parse(uuid, account), p_installation: parse(uuid, installation), p_repository: parse(uuid, repository) });
    if (result === null) throw new GitHubAppError("not_found");
    return parse(storedRepositorySchema, result);
  }
  async unlink(actor: string, account: string) { await this.call("unlink", actor, { p_account: parse(uuid, account) }); }
}

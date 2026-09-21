import { z } from "zod";
import { REPOSITORY_ATTESTATION_TEXT, REPOSITORY_ATTESTATION_VERSION, SavedRepositorySelectionSchema, SaveRepositorySelectionSchema, GitHubRepositorySummarySchema, type ErrorCode } from "@repofy/contracts";
import { coverageDeclaration } from "../coverage/manifest";
import type { FeatureOneRpcClient } from "../analysis/persistence";
import { GitHubVault, digest } from "./crypto";
import type { GitHubConnectionService } from "./service";

export class SelectionError extends Error {
  constructor(readonly code: ErrorCode, message: string, readonly status = 409) { super(message); }
}
const storedSchema = z.object({ revision: z.uuid(), items: z.array(z.object({
  repositoryId: z.uuid(), grantId: z.uuid(), accessRevision: z.uuid(), accountId: z.uuid(), installationId: z.uuid(),
  status: z.enum(["active", "revoked"]), attestedAt: z.iso.datetime(), displayEncrypted: z.string(),
})) });
const displaySchema = GitHubRepositorySummarySchema.omit({ repositoryId: true, accountId: true, installationId: true }).extend({ ownerType: z.enum(["User", "Organization"]) });
export class RepositorySelectionService {
  constructor(private readonly db: FeatureOneRpcClient, private readonly github: Pick<GitHubConnectionService, "verifyRepository">,
    private readonly vault: GitHubVault, readonly maxRepositories: number) {}
  private async rpc(name: string, args: Record<string, unknown>) {
    let result;
    try { result = await this.db.rpc(`feature_one_selection_${name}`, args); }
    catch { throw new SelectionError("INTERNAL_ERROR", "Repository selection is temporarily unavailable.", 503); }
    if (result.error) {
      const message = result.error.message;
      if (message === "CONSENT_REQUIRED") throw new SelectionError("CONSENT_REQUIRED", "Confirm your authorization for private and organization repositories.", 400);
      if (message === "IDEMPOTENCY_CONFLICT" || message === "SELECTION_CONFLICT") throw new SelectionError("IDEMPOTENCY_CONFLICT", "Your saved selection changed. Refresh it before saving again.");
      if (["ACCESS_REVOKED", "ACCESS_CHANGED", "RECONNECT_REQUIRED", "NOT_FOUND"].includes(message ?? "")) throw new SelectionError("REPOSITORY_ACCESS_REVOKED", "Repository access changed. Reconnect or refresh, then select authorized repositories again.", 403);
      if (message === "INVALID_REQUEST") throw new SelectionError("INVALID_REQUEST", "Invalid repository selection.", 400);
      throw new SelectionError("INTERNAL_ERROR", "Repository selection is temporarily unavailable.", 503);
    }
    return result.data;
  }
  private response(actor: string, raw: unknown) {
    const saved = storedSchema.parse(raw);
    return SavedRepositorySelectionSchema.parse({ revision: saved.revision, repositories: saved.items.map(({ displayEncrypted, ...item }) => ({
      ...item, ...displaySchema.parse(this.vault.open(displayEncrypted, `selection:${actor}:${item.repositoryId}`)),
    })), policy: { maxRepositories: this.maxRepositories, attestationVersion: REPOSITORY_ATTESTATION_VERSION,
      attestationText: REPOSITORY_ATTESTATION_TEXT, allowArchived: false, requireDefaultBranch: true, analysisAvailable: false, coverage: coverageDeclaration() } });
  }
  async read(actor: string) { return this.response(actor, await this.rpc("read", { p_actor: actor })); }
  async save(actor: string, input: unknown, requestId: string) {
    const parsed = SaveRepositorySelectionSchema.safeParse(input);
    if (!parsed.success) throw new SelectionError("INVALID_REQUEST", "Invalid repository selection.", 400);
    const request = parsed.data;
    if (request.repositories.length > this.maxRepositories) throw new SelectionError("INVALID_REQUEST", `Select at most ${this.maxRepositories} repositories.`, 400);
    const epoch = z.uuid().parse(await this.rpc("epoch", {}));
    const repositories = [...request.repositories].sort((a, b) => a.repositoryId.localeCompare(b.repositoryId));
    const items = [];
    for (const choice of repositories) {
      const verified = await this.github.verifyRepository(actor, choice.accountId, choice.installationId, choice.repositoryId);
      const { item, installation, identity, revision } = verified;
      if (item.archived || !item.default_branch) throw new SelectionError("INVALID_REQUEST", "Select repositories with a default branch that are not archived.", 400);
      if ((item.private || installation.account.type === "Organization") && !request.attestation) throw new SelectionError("CONSENT_REQUIRED", "Confirm your authorization for private and organization repositories.", 400);
      const display = { fullName: `${item.owner.login}/${item.name}`, visibility: item.private ? "private" : "public",
        defaultBranch: item.default_branch, archived: item.archived, ownerType: installation.account.type };
      items.push({ ...choice, credentialRevision: revision,
        displayEncrypted: this.vault.seal(display, `selection:${actor}:${choice.repositoryId}`),
        facts: { providerUserId: identity.id, login: identity.login, providerInstallationId: installation.id,
          providerOwnerId: item.owner.id, ownerType: installation.account.type, providerRepositoryId: item.id, visibility: display.visibility } });
    }
    return this.response(actor, await this.rpc("save", { p_actor: actor, p_expected: request.expectedRevision,
      p_key: request.idempotencyKey, p_hash: digest(JSON.stringify({ ...request, repositories })), p_epoch: epoch,
      p_items: items, p_limit: this.maxRepositories, p_attestation: !!request.attestation, p_request_id: requestId }));
  }
  async remove(actor: string, grant: string, requestId: string) {
    if (!z.uuid().safeParse(grant).success) throw new SelectionError("INVALID_REQUEST", "Invalid repository selection.", 400);
    return this.response(actor, await this.rpc("remove", { p_actor: actor, p_grant: grant, p_request_id: requestId }));
  }
  /** Runs 06–07: call before dispatch, each retrieval, and before publication; never cache. */
  async checkGrant(actor: string, grant: string, revision: string) {
    await this.rpc("check_grant", { p_actor: z.uuid().parse(actor), p_grant: z.uuid().parse(grant), p_revision: z.uuid().parse(revision) });
  }
}

import { z } from "zod";
import {
  GitHubAccountsResponseSchema, GitHubConnectionStartSchema, GitHubInstallationsResponseSchema,
  GitHubRepositoriesResponseSchema, GitHubReturnPathSchema, type GitHubDiscoveryIssue, type GitHubPermissionStatus,
} from "@repofy/contracts";
import { digest, GitHubVault, randomSecret } from "./crypto";
import { GitHubAppError } from "./errors";
import { BranchSchema, Login, ProviderId, RepoName, type GitHubAppProvider, type ProviderInstallation, type ReadPermission, type InstallationCredential, type ProviderRepository } from "./provider";
import { GitHubConnectionRepository } from "./repository";

const CONNECT = "/api/v1/github/installations/start" as const;
const stateSchema = z.strictObject({
  intent: z.enum(["install", "link"]), returnTo: GitHubReturnPathSchema, verifier: z.string().max(100).optional(),
  accountId: z.uuid().optional(), expectedProviderId: ProviderId.optional(),
});
const cursorSchema = z.strictObject({ page: z.number().int().min(1).max(10000), perPage: z.number().int().min(1).max(100), expires: z.number().int() });
export interface ConnectionSession { actor: string; binding: string; sessionId: string }
export interface GitHubFlowConfig { appId: string; clientId: string; slug: string; frontendOrigin: string }
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value); if (!result.success) throw new GitHubAppError("invalid_request"); return result.data;
}
export function permissionStatus(installation: ProviderInstallation): GitHubPermissionStatus {
  return { contents: installation.permissions.contents ?? "none", pullRequests: installation.permissions.pull_requests ?? "none",
    checks: installation.permissions.checks ?? "none", actions: installation.permissions.actions ?? "none", commitStatuses: installation.permissions.statuses ?? "none" };
}
export function requireActive(installation: ProviderInstallation): void {
  if (installation.suspended_at) throw new GitHubAppError("installation_suspended");
  if (!installation.permissions.contents) throw new GitHubAppError("insufficient_permissions");
}

export class GitHubConnectionService {
  constructor(readonly repository: GitHubConnectionRepository, private readonly provider: GitHubAppProvider,
    private readonly vault: GitHubVault, private readonly config: GitHubFlowConfig, private readonly now: () => number = Date.now) {}
  private callbackUrl(stage: "authorize" | "callback") { return `${this.config.frontendOrigin}/api/v1/github/installations/${stage}`; }
  private destination(path: z.infer<typeof GitHubReturnPathSchema>, status: string) {
    const url = new URL(path, this.config.frontendOrigin); url.searchParams.set("github", status); return url.toString();
  }
  private async newState(session: ConnectionSession, stage: "authorize" | "install", payload: z.infer<typeof stateSchema>) {
    const state = randomSecret(); const stateHash = digest(state); const expiresAt = new Date(this.now() + 600000).toISOString();
    await this.repository.startState(session.actor, stateHash, session.binding, stage,
      this.vault.seal(payload, `state:${session.actor}:${stateHash}`), expiresAt, session.sessionId);
    return { state, expiresAt };
  }
  private async consume(session: ConnectionSession, state: string, stage: "authorize" | "install") {
    if (!/^[A-Za-z0-9_-]{43}$/.test(state)) throw new GitHubAppError("invalid_state");
    const stateHash = digest(state);
    const stored = await this.repository.consumeState(session.actor, stateHash, session.binding, stage);
    try { return stateSchema.parse(this.vault.open(stored, `state:${session.actor}:${stateHash}`)); }
    catch { throw new GitHubAppError("invalid_state"); }
  }
  async start(session: ConnectionSession, input: unknown) {
    const request = parse(GitHubConnectionStartSchema, input);
    const expectedProviderId = request.accountId ? (await this.repository.identity(session.actor, request.accountId)).providerUserId : undefined;
    const verifier = randomSecret();
    const { state, expiresAt } = await this.newState(session, "authorize", { ...request, verifier, expectedProviderId });
    const url = new URL("https://github.com/login/oauth/authorize");
    url.search = new URLSearchParams({ client_id: this.config.clientId, redirect_uri: this.callbackUrl("authorize"), state,
      code_challenge: Buffer.from(digest(verifier), "hex").toString("base64url"), code_challenge_method: "S256", prompt: "select_account" }).toString();
    return { authorizeUrl: url.toString(), expiresAt };
  }
  async authorize(session: ConnectionSession, state: string, code?: string) {
    const pending = await this.consume(session, state, "authorize");
    if (!code || !pending.verifier) throw new GitHubAppError("reconnect_required");
    const credential = await this.provider.exchangeCode(code, pending.verifier, this.callbackUrl("authorize"));
    const user = await this.provider.getUser(credential.token);
    if (pending.expectedProviderId && pending.expectedProviderId !== user.id) throw new GitHubAppError("identity_conflict");
    const accountId = await this.repository.link(session.actor, user.id, user.login,
      this.vault.seal({ token: credential.token }, `user:${session.actor}:${user.id}`), credential.expiresAt, digest(state));
    if (pending.intent === "link") return { redirect: this.destination(pending.returnTo, "connected"), pending: false };
    const next = await this.newState(session, "install", { intent: pending.intent, returnTo: pending.returnTo, accountId });
    const url = new URL(`https://github.com/apps/${this.config.slug}/installations/new`);
    url.searchParams.set("state", next.state);
    return { redirect: url.toString(), pending: true };
  }
  private async verifiedCredential(actor: string, account: string) {
    const stored = await this.repository.credential(actor, account);
    if (Date.parse(stored.expiresAt) - this.now() < 60000) throw new GitHubAppError("reconnect_required");
    const credential = parse(z.strictObject({ token: z.string().min(1).max(2048) }), this.vault.open(stored.encrypted, `user:${actor}:${stored.providerUserId}`));
    const user = await this.provider.getUser(credential.token);
    if (user.id !== stored.providerUserId) throw new GitHubAppError("identity_conflict");
    return { ...stored, token: credential.token, user };
  }
  async installed(session: ConnectionSession, state: string, installationId?: string, action?: string) {
    const pending = await this.consume(session, state, "install");
    if (!pending.accountId) throw new GitHubAppError("invalid_state");
    if (action === "request") return { redirect: this.destination(pending.returnTo, "pending_approval"), pending: false };
    if (!installationId) throw new GitHubAppError("installation_missing");
    const credential = await this.verifiedCredential(session.actor, pending.accountId);
    // A setup URL's installation_id is an untrusted hint. Require a fresh user-visible
    // installation and independently fetch the app's current owner/status before association.
    let visible: ProviderInstallation | undefined;
    for (let page = 1; page <= 10; page++) {
      const result = await this.provider.listInstallations(credential.token, page, 100);
      visible = result.items.find(item => item.id === installationId);
      if (visible || !result.hasNext) break;
      if (page === 10) throw new GitHubAppError("pagination_limit");
    }
    if (!visible) throw new GitHubAppError("installation_missing");
    const current = await this.provider.getInstallation(installationId);
    this.sameInstallation(visible, current);
    await this.repository.associate(session.actor, pending.accountId, credential.revision, current);
    const status = current.suspended_at ? "installation_suspended" : !current.permissions.contents ? "insufficient_permissions" : "connected";
    return { redirect: this.destination(pending.returnTo, status), pending: false };
  }
  private sameInstallation(left: ProviderInstallation, right: ProviderInstallation) {
    if (left.id !== right.id || right.app_id !== this.config.appId || left.app_id !== this.config.appId
      || left.account.id !== right.account.id || left.account.type !== right.account.type) throw new GitHubAppError("access_changed");
  }
  async accounts(actor: string) { return GitHubAccountsResponseSchema.parse({ accounts: await this.repository.accounts(actor), connectPath: CONNECT }); }
  async unlink(actor: string, account: string) { await this.repository.unlink(actor, account); }

  private pagination(context: string, cursor?: string, perPage?: number) {
    if (!cursor) return { page: 1, perPage: perPage ?? 30, expires: this.now() + 600000 };
    try {
      const payload = cursorSchema.parse(this.vault.open(cursor, `cursor:${context}`));
      if (payload.expires <= this.now() || (perPage !== undefined && perPage !== payload.perPage)) throw new Error();
      return payload;
    } catch { throw new GitHubAppError("invalid_request"); }
  }
  private pageResult(context: string, page: z.infer<typeof cursorSchema>, hasNext: boolean, issues: GitHubDiscoveryIssue[] = []) {
    if (hasNext && page.page === 10000) issues.push("pagination_limit");
    return { status: hasNext || issues.length ? "partial" as const : "complete" as const,
      nextCursor: hasNext && page.page < 10000 ? this.vault.seal({ ...page, page: page.page + 1 }, `cursor:${context}`) : null,
      issues: [...new Set(issues)], connectPath: CONNECT };
  }
  private unavailable(error: unknown) {
    if (!(error instanceof GitHubAppError) || ["invalid_request", "invalid_state", "not_found", "database_failure"].includes(error.code)) throw error;
    return { status: "unavailable" as const, nextCursor: null, issues: [error.code],
      ...(error.retryAfterSeconds ? { retryAfterSeconds: error.retryAfterSeconds } : {}), connectPath: CONNECT };
  }
  async installations(actor: string, account: string, cursor?: string, perPage?: number) {
    const context = `installations:${actor}:${account}`; const page = this.pagination(context, cursor, perPage);
    try {
      const credential = await this.verifiedCredential(actor, account);
      const result = await this.provider.listInstallations(credential.token, page.page, page.perPage);
      const installations = [];
      for (const item of result.items) {
        if (item.app_id !== this.config.appId) throw new GitHubAppError("access_changed");
        const installationId = await this.repository.associate(actor, account, credential.revision, item);
        installations.push({ installationId, accountId: account, ownerLogin: item.account.login, ownerType: item.account.type,
          status: item.suspended_at ? "suspended" : "active", selection: item.repository_selection, permissions: permissionStatus(item) });
      }
      return GitHubInstallationsResponseSchema.parse({ ...this.pageResult(context, page, result.hasNext), installations });
    } catch (error) { return GitHubInstallationsResponseSchema.parse({ ...this.unavailable(error), installations: [] }); }
  }
  private async currentInstallation(actor: string, account: string, installation: string, revision: string) {
    const connection = await this.repository.connection(actor, account, installation);
    let current;
    try { current = await this.provider.getInstallation(connection.providerInstallationId); }
    catch (error) {
      if (error instanceof GitHubAppError && error.code === "installation_missing") await this.repository.markMissing(actor, account, revision, installation);
      throw error;
    }
    if (current.app_id !== this.config.appId || current.account.id !== connection.providerOwnerId || current.account.type !== connection.ownerType) throw new GitHubAppError("access_changed");
    // Preserve authoritative suspension/permission changes even if the next operation is denied.
    if (current.suspended_at || !current.permissions.contents) await this.repository.associate(actor, account, revision, current);
    return current;
  }
  async repositories(actor: string, account: string, installation: string, cursor?: string, perPage?: number) {
    const context = `repositories:${actor}:${account}:${installation}`; const page = this.pagination(context, cursor, perPage);
    // Reject missing/foreign opaque references before provider access.
    await this.repository.connection(actor, account, installation);
    try {
      const credential = await this.verifiedCredential(actor, account);
      const current = await this.currentInstallation(actor, account, installation, credential.revision);
      requireActive(current);
      const result = await this.provider.listRepositories(credential.token, current.id, page.page, page.perPage);
      const eligible = result.items.filter(item => item.permissions.pull && item.owner.id === current.account.id);
      if (new Set(eligible.map(item => item.id)).size !== eligible.length) throw new GitHubAppError("provider_unavailable");
      await this.repository.associate(actor, account, credential.revision, current);
      const refs = await this.repository.discover(actor, account, credential.revision, installation, eligible.map(item => ({
        id: item.id, providerOwnerId: item.owner.id, visibility: item.private ? "private" : "public",
        locatorEncrypted: this.vault.seal({ owner: item.owner.login, name: item.name }, `repo:${actor}:${account}:${installation}:${item.id}`),
      })));
      const repositories = eligible.map(item => ({ repositoryId: refs.find(ref => ref.providerRepositoryId === item.id)?.repositoryId,
        installationId: installation, accountId: account, fullName: `${item.owner.login}/${item.name}`, visibility: item.private ? "private" : "public",
        defaultBranch: item.default_branch, archived: item.archived }));
      return GitHubRepositoriesResponseSchema.parse({ ...this.pageResult(context, page, result.hasNext,
        eligible.length !== result.items.length ? ["access_changed"] : []), repositories });
    } catch (error) { return GitHubRepositoriesResponseSchema.parse({ ...this.unavailable(error), repositories: [] }); }
  }

  /** Selection saves add explicit attestation before atomically binding grants. A discovery reference never suffices.
   * Fresh user + installation checks are repeated even if the caller saved a prior page. */
  async verifyRepository(actor: string, account: string, installation: string, repository: string) {
    const saved = await this.repository.repository(actor, account, installation, repository);
    const credential = await this.verifiedCredential(actor, account);
    const current = await this.currentInstallation(actor, account, installation, credential.revision);
    requireActive(current);
    const locator = parse(z.strictObject({ owner: Login, name: RepoName }),
      this.vault.open(saved.locatorEncrypted, `repo:${actor}:${account}:${installation}:${saved.providerRepositoryId}`));
    const item = await this.provider.getRepository(credential.token, locator.owner, locator.name);
    if (item.id !== saved.providerRepositoryId || item.owner.id !== current.account.id || item.owner.id !== saved.providerOwnerId || !item.permissions.pull) throw new GitHubAppError("access_changed");
    const actual = await this.provider.getRepositoryInstallation(item.owner.login, item.name);
    this.sameInstallation(current, actual); requireActive(actual);
    // Fence unlink or credential replacement while GitHub calls were in flight.
    const latest = await this.repository.credential(actor, account);
    if (latest.revision !== credential.revision) throw new GitHubAppError("reconnect_required");
    return { item, installation: actual, identity: credential.user, revision: credential.revision };
  }
  async withVerifiedRepositoryToken<T>(actor: string, account: string, installation: string, repository: string,
    permissions: ReadPermission[], use: (credential: InstallationCredential, repository: ProviderRepository, identity: { id: string }) => Promise<T>): Promise<T> {
    const verified = await this.verifyRepository(actor, account, installation, repository);
    if (permissions.some(permission => !verified.installation.permissions[permission])) throw new GitHubAppError("insufficient_permissions");
    return this.provider.withInstallationToken(verified.installation.id, [verified.item.id], permissions, async credential => {
      credential.assertValid();
      const result = await use(credential, verified.item, verified.identity);
      if ((await this.repository.credential(actor, account)).revision !== verified.revision) throw new GitHubAppError("reconnect_required");
      return result;
    });
  }
  async resolveCommit(actor: string, account: string, installation: string, repository: string, branch: string) {
    parse(BranchSchema, branch);
    return this.withVerifiedRepositoryToken(actor, account, installation, repository, ["contents"], async (credential, item) =>
      ({ repositoryId: repository, providerRepositoryId: item.id, branch,
        commitSha: await this.provider.resolveCommit(credential.token, item.owner.login, item.name, branch) }));
  }
  /** Worker-only: choose the current default branch after fresh authorization. */
  async resolveDefaultCommit(actor: string, account: string, installation: string, repository: string) {
    return this.withVerifiedRepositoryToken(actor, account, installation, repository, ["contents"], async (credential, item) => {
      if (item.archived || !item.default_branch) throw new GitHubAppError("access_changed");
      return { providerRepositoryId: item.id, branch: item.default_branch, repositoryVisibility: item.private ? "private" as const : "public" as const,
        commitSha: await this.provider.resolveCommit(credential.token, item.owner.login, item.name, item.default_branch) };
    });
  }
}

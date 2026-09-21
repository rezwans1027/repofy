import { randomUUID } from "node:crypto";
import type { FeatureOneRpcClient } from "../../src/domain/analysis/persistence";
import type { GitHubAppProvider, ProviderInstallation, ProviderRepository, ReadPermission, InstallationCredential } from "../../src/domain/github-app/provider";
import { GitHubAppError } from "../../src/domain/github-app/errors";

export const actor1 = "11111111-1111-4111-8111-111111111111";
export const actor2 = "22222222-2222-4222-8222-222222222222";
export const testKey = "ab".repeat(32);
export const fixtureInstallation = (): ProviderInstallation => ({ id: "500", app_id: "42", account: { id: "200", login: "fixture-org", type: "Organization" },
  repository_selection: "selected", suspended_at: null, permissions: { contents: "read", metadata: "read", pull_requests: "read" } });
export const fixtureRepository = (id = "300"): ProviderRepository => ({ id, name: `synthetic-private-${id}`, owner: { id: "200", login: "fixture-org" },
  private: true, default_branch: "main", archived: false, permissions: { pull: true } });

/** Local synthetic provider for connection-flow testing. Never registered in production. */
export class SyntheticGitHubProvider implements GitHubAppProvider {
  users = new Map([["fixture_user100", { id: "100", login: "fixture-one" }], ["fixture_user101", { id: "101", login: "fixture-two" }]]);
  installations = new Map([["500", fixtureInstallation()]]);
  repositories = new Map([["300", fixtureRepository()], ["301", fixtureRepository("301")]]);
  access = new Map([["fixture_user100", new Map([["500", ["300"]]])], ["fixture_user101", new Map([["500", ["301"]]])]]);
  scopes: { installation: string; repositoryIds: string[]; permissions: ReadPermission[] }[] = [];
  failure?: GitHubAppError;
  constructor(readonly now: () => number = Date.now) {}
  async exchangeCode(code: string) { return { token: code === "second" ? "fixture_user101" : "fixture_user100", expiresAt: new Date(this.now() + 28800000).toISOString() }; }
  async getUser(token: string) {
    if (this.failure) throw this.failure;
    const user = this.users.get(token); if (!user) throw new GitHubAppError("reconnect_required"); return user;
  }
  async listInstallations(token: string, page: number, perPage: number) {
    const ids = [...(this.access.get(token)?.keys() ?? [])]; const items = ids.map(id => this.installations.get(id)!).filter(Boolean);
    return { items: items.slice((page - 1) * perPage, page * perPage), hasNext: items.length > page * perPage };
  }
  async getInstallation(id: string) { const item = this.installations.get(id); if (!item) throw new GitHubAppError("installation_missing"); return structuredClone(item); }
  async listRepositories(token: string, installation: string, page: number, perPage: number) {
    const ids = this.access.get(token)?.get(installation); if (!ids) throw new GitHubAppError("installation_missing");
    const items = ids.map(id => this.repositories.get(id)!).filter(Boolean);
    return { items: items.slice((page - 1) * perPage, page * perPage), hasNext: items.length > page * perPage };
  }
  async getRepository(token: string, owner: string, name: string) {
    const ids = [...(this.access.get(token)?.values() ?? [])].flat();
    const item = [...this.repositories.values()].find(repo => repo.name === name && repo.owner.login === owner && ids.includes(repo.id));
    if (!item) throw new GitHubAppError("installation_missing"); return structuredClone(item);
  }
  async getRepositoryInstallation(owner: string) {
    const item = [...this.installations.values()].find(value => value.account.login === owner);
    if (!item) throw new GitHubAppError("installation_missing"); return structuredClone(item);
  }
  async withInstallationToken<T>(installation: string, repositoryIds: string[], permissions: ReadPermission[], use: (credential: InstallationCredential) => Promise<T>) {
    this.scopes.push({ installation, repositoryIds, permissions });
    return use({ token: "fixture_installation_ephemeral", expiresAt: new Date(this.now() + 3600000).toISOString(), assertValid: () => {} });
  }
  async resolveCommit() { return "a".repeat(40); }
}

/** Transactional-policy double for HTTP/domain tests. Real SQL has separate PostgreSQL tests. */
export class MemoryGitHubRpc implements FeatureOneRpcClient {
  calls: { name: string; args: Record<string, unknown> }[] = [];
  states = new Map<string, Record<string, any>>();
  accounts = new Map<string, Record<string, any>>();
  connections = new Map<string, Record<string, any>>();
  discoveries = new Map<string, Record<string, any>>();
  repoIds = new Map<string, string>();
  installIds = new Map<string, string>();
  constructor(readonly now: () => number = Date.now) {}
  private requireAccount(actor: string, id: string, revision?: string) {
    const account = this.accounts.get(id);
    if (!account || account.actor !== actor || account.revoked || Date.parse(account.expiresAt) <= this.now() + 60000 || (revision && revision !== account.revision)) throw new Error("RECONNECT_REQUIRED");
    return account;
  }
  async rpc(name: string, args: Record<string, any>) {
    this.calls.push({ name, args });
    const { p_actor: actor, p_account: id, p_installation: installation } = args;
    let data: unknown = null;
    try {
      switch (name.replace("feature_one_github_", "")) {
        case "start_state": this.states.set(args.p_hash, { ...args }); break;
        case "consume_state": {
          const state = this.states.get(args.p_hash);
          if (!state || state.consumed || state.p_actor !== actor || state.p_binding !== args.p_binding || state.p_stage !== args.p_stage || Date.parse(state.p_expires) <= this.now()) throw new Error("INVALID_STATE");
          state.consumed = true; data = state.p_payload; break;
        }
        case "link": {
          const state = this.states.get(args.p_state_hash);
          if (!state || state.p_actor !== actor || !state.consumed || Date.parse(state.p_expires) <= this.now()) throw new Error("INVALID_STATE");
          this.states.delete(args.p_state_hash);
          const existing = [...this.accounts.values()].find(a => a.providerUserId === args.p_provider);
          if (existing && existing.actor !== actor) throw new Error("IDENTITY_CONFLICT");
          const accountId = existing?.accountId ?? randomUUID();
          this.accounts.set(accountId, { actor, accountId, providerUserId: args.p_provider, login: args.p_login, encrypted: args.p_token, expiresAt: args.p_expires, revision: randomUUID() });
          data = accountId; break;
        }
        case "accounts": data = [...this.accounts.values()].filter(a => a.actor === actor).map(a => ({ accountId: a.accountId, login: a.login,
          status: a.revoked ? "unlinked" : Date.parse(a.expiresAt) > this.now() + 60000 ? "connected" : "reconnect_required", verifiedAt: new Date(this.now()).toISOString() })); break;
        case "identity": { const a = this.accounts.get(id); data = a && a.actor === actor ? { providerUserId: a.providerUserId } : null; break; }
        case "credential": {
          try { const { actor: _actor, revoked: _revoked, ...a } = this.requireAccount(actor, id); data = a; } catch { data = null; } break;
        }
        case "associate": {
          this.requireAccount(actor, id, args.p_revision);
          const facts = args.p_facts;
          const installationId = this.installIds.get(facts.id) ?? randomUUID(); this.installIds.set(facts.id, installationId);
          this.connections.set(`${actor}:${id}:${installationId}`, { providerInstallationId: facts.id, providerOwnerId: facts.account.id, ownerType: facts.account.type }); data = installationId; break;
        }
        case "connection": data = this.connections.get(`${actor}:${id}:${installation}`) ?? null; break;
        case "mark_missing": this.requireAccount(actor, id, args.p_revision); break;
        case "discover": {
          this.requireAccount(actor, id, args.p_revision);
          if (!this.connections.has(`${actor}:${id}:${installation}`)) throw new Error("NOT_FOUND");
          data = args.p_repositories.map((item: Record<string, string>) => {
            const repositoryId = this.repoIds.get(item.id) ?? randomUUID(); this.repoIds.set(item.id, repositoryId);
            this.discoveries.set(`${actor}:${id}:${installation}:${repositoryId}`, { providerRepositoryId: item.id, providerOwnerId: item.providerOwnerId, locatorEncrypted: item.locatorEncrypted });
            return { providerRepositoryId: item.id, repositoryId };
          }); break;
        }
        case "repository": data = this.discoveries.get(`${actor}:${id}:${installation}:${args.p_repository}`) ?? null; break;
        case "unlink": {
          const account = this.accounts.get(id);
          if (account && account.actor === actor) {
            account.revoked = true; account.encrypted = undefined;
            for (const key of this.connections.keys()) if (key.startsWith(`${actor}:${id}:`)) this.connections.delete(key);
            for (const key of this.discoveries.keys()) if (key.startsWith(`${actor}:${id}:`)) this.discoveries.delete(key);
            for (const [key, value] of this.states) if (value.p_actor === actor) this.states.delete(key);
          } break;
        }
        default: throw new Error("UNKNOWN_RPC");
      }
      return { data, error: null };
    } catch (error) { return { data: null, error: { message: (error as Error).message } }; }
  }
}

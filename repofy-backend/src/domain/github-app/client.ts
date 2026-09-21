import { createPrivateKey, sign } from "node:crypto";
import { z } from "zod";
import { GitHubAppError } from "./errors";
import {
  BranchSchema, CommitSchema, Login, ProviderId, ProviderInstallationSchema, ProviderRepositorySchema,
  ProviderUserSchema, RepoName, type GitHubAppProvider, type InstallationCredential, type ReadPermission,
} from "./provider";

const API = "https://api.github.com";
const API_VERSION = "2026-03-10";
const tokenSchema = z.string().min(1).max(2048).regex(/^[A-Za-z0-9_]+$/);
export interface GitHubClientConfig {
  appId: string; clientId: string; clientSecret: string;
  privateKey: () => string; // Managed secret injection; never returned by a route or persisted.
}

/** No token or repository cache. Every authorization decision is refreshed upstream.
 * Fetch is injected for synthetic tests, never selectable through an HTTP request. */
export class GitHubHttpClient implements GitHubAppProvider {
  constructor(private readonly config: GitHubClientConfig, private readonly fetcher: typeof fetch = fetch,
    private readonly now: () => number = Date.now) {}

  private jwt(): string {
    try {
      const seconds = Math.floor(this.now() / 1000);
      const key = createPrivateKey(this.config.privateKey().replaceAll("\\n", "\n"));
      if (key.asymmetricKeyType !== "rsa" || (key.asymmetricKeyDetails?.modulusLength ?? 0) < 2048) throw new Error();
      const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
      const payload = Buffer.from(JSON.stringify({ iat: seconds - 60, exp: seconds + 540, iss: this.config.clientId })).toString("base64url");
      const input = `${header}.${payload}`;
      return `${input}.${sign("RSA-SHA256", Buffer.from(input), key).toString("base64url")}`;
    } catch { throw new GitHubAppError("provider_unavailable"); }
  }

  private async request(path: string, token: string | undefined, method = "GET", body?: unknown, oauth = false): Promise<{ data: unknown; headers: Headers }> {
    try {
      const response = await this.fetcher(`${oauth ? "https://github.com" : API}${path}`, {
        method, redirect: "manual", signal: AbortSignal.timeout(15000),
        headers: { Accept: oauth ? "application/json" : "application/vnd.github+json", "User-Agent": "Repofy", "X-GitHub-Api-Version": API_VERSION,
          ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (!response.ok) {
        await response.body?.cancel();
        const remaining = response.headers.get("x-ratelimit-remaining");
        const retry = response.headers.get("retry-after");
        if (response.status === 429 || (response.status === 403 && (remaining === "0" || retry !== null))) {
          const raw = retry && /^\d+$/.test(retry) ? Number(retry) : Number(response.headers.get("x-ratelimit-reset")) - this.now() / 1000;
          throw new GitHubAppError("rate_limited", Number.isFinite(raw) && raw > 0 ? Math.min(86400, Math.max(1, Math.ceil(raw))) : 60);
        }
        if (response.status === 401) throw new GitHubAppError("reconnect_required");
        if (response.status === 403) throw new GitHubAppError("insufficient_permissions");
        if (response.status === 404) throw new GitHubAppError("installation_missing");
        if ([301, 302, 307, 308, 409, 422].includes(response.status)) throw new GitHubAppError("access_changed");
        throw new GitHubAppError("provider_unavailable");
      }
      if (response.status === 204) return { data: null, headers: response.headers };
      const reader = response.body?.getReader();
      if (!reader) throw new GitHubAppError("provider_unavailable");
      const chunks: Uint8Array[] = []; let size = 0;
      try {
        while (true) {
          const chunk = await reader.read(); if (chunk.done) break;
          size += chunk.value.length;
          if (size > 2 * 1024 * 1024) { await reader.cancel(); throw new GitHubAppError("provider_unavailable"); }
          chunks.push(chunk.value);
        }
      } finally { reader.releaseLock(); }
      return { data: JSON.parse(Buffer.concat(chunks).toString("utf8")), headers: response.headers };
    } catch (error) {
      if (error instanceof GitHubAppError) throw error;
      // Network exceptions, JSON errors and provider bodies can embed tokens or private names.
      throw new GitHubAppError("provider_unavailable");
    }
  }

  private parse<T>(schema: z.ZodType<T>, data: unknown): T {
    const parsed = schema.safeParse(data);
    if (!parsed.success) throw new GitHubAppError("provider_unavailable");
    return parsed.data;
  }
  private hasNext(headers: Headers, page: number, perPage: number, total: number): boolean {
    // Never follow upstream Link URLs. Only a locally constructed bounded page number is used.
    return /rel="next"/.test(headers.get("link") ?? "") || page * perPage < total;
  }
  private pagination(page: number, perPage: number): string {
    if (!Number.isInteger(page) || page < 1 || page > 10000 || !Number.isInteger(perPage) || perPage < 1 || perPage > 100) throw new GitHubAppError("invalid_request");
    return `?per_page=${perPage}&page=${page}`;
  }
  private repoPath(owner: string, name: string): string {
    return `/repos/${encodeURIComponent(this.parse(Login, owner))}/${encodeURIComponent(this.parse(RepoName, name))}`;
  }
  async exchangeCode(code: string, verifier: string, redirectUri: string) {
    const { data } = await this.request("/login/oauth/access_token", undefined, "POST", {
      client_id: this.config.clientId, client_secret: this.config.clientSecret, code, code_verifier: verifier, redirect_uri: redirectUri,
    }, true);
    const result = this.parse(z.object({ access_token: tokenSchema, token_type: z.literal("bearer"),
      expires_in: z.number().int().min(60).max(28800).optional(), scope: z.literal("").optional() }), data);
    // Expiration is optional at GitHub. Locally cap all user credentials at eight hours;
    // discard refresh tokens and explicitly reconnect. Installation credentials are never sealed.
    return { token: result.access_token, expiresAt: new Date(this.now() + (result.expires_in ?? 28800) * 1000).toISOString() };
  }
  async getUser(token: string) { return this.parse(ProviderUserSchema, (await this.request("/user", token)).data); }
  async listInstallations(token: string, page: number, perPage: number) {
    const response = await this.request(`/user/installations${this.pagination(page, perPage)}`, token);
    const data = this.parse(z.object({ total_count: z.number().int().nonnegative(), installations: z.array(ProviderInstallationSchema).max(perPage) }), response.data);
    if (data.installations.some(item => item.app_id !== this.config.appId)) throw new GitHubAppError("provider_unavailable");
    return { items: data.installations, hasNext: this.hasNext(response.headers, page, perPage, data.total_count) };
  }
  async getInstallation(id: string) {
    const data = this.parse(ProviderInstallationSchema, (await this.request(`/app/installations/${this.parse(ProviderId, id)}`, this.jwt())).data);
    if (data.id !== id || data.app_id !== this.config.appId) throw new GitHubAppError("installation_missing");
    return data;
  }
  async listRepositories(token: string, installation: string, page: number, perPage: number) {
    const response = await this.request(`/user/installations/${this.parse(ProviderId, installation)}/repositories${this.pagination(page, perPage)}`, token);
    const data = this.parse(z.object({ total_count: z.number().int().nonnegative(), repositories: z.array(ProviderRepositorySchema).max(perPage) }), response.data);
    return { items: data.repositories, hasNext: this.hasNext(response.headers, page, perPage, data.total_count) };
  }
  async getRepository(token: string, owner: string, name: string) {
    return this.parse(ProviderRepositorySchema, (await this.request(this.repoPath(owner, name), token)).data);
  }
  async getRepositoryInstallation(owner: string, name: string) {
    const data = this.parse(ProviderInstallationSchema, (await this.request(`${this.repoPath(owner, name)}/installation`, this.jwt())).data);
    if (data.app_id !== this.config.appId) throw new GitHubAppError("installation_missing");
    return data;
  }
  async withInstallationToken<T>(installation: string, repositoryIds: string[], permissions: ReadPermission[], use: (credential: InstallationCredential) => Promise<T>): Promise<T> {
    if (repositoryIds.length !== 1 || permissions.length < 1 || new Set(permissions).size !== permissions.length
      || permissions.some(permission => !["contents", "pull_requests", "checks", "actions", "statuses"].includes(permission))) throw new GitHubAppError("invalid_request");
    const ids = repositoryIds.map(id => Number(this.parse(ProviderId, id)));
    if (ids.some(id => !Number.isSafeInteger(id))) throw new GitHubAppError("invalid_request");
    const scope = Object.fromEntries([...["metadata"], ...permissions].map(name => [name, "read"]));
    const { data } = await this.request(`/app/installations/${this.parse(ProviderId, installation)}/access_tokens`, this.jwt(), "POST", { repository_ids: ids, permissions: scope });
    // Capture only a syntactically safe token for cleanup if GitHub returns an invalid scope.
    let token = z.object({ token: tokenSchema }).safeParse(data).data?.token;
    let active = true;
    let issued: InstallationCredential | undefined;
    try {
      const result = this.parse(z.object({ token: tokenSchema, expires_at: z.string().datetime({ offset: true }),
        permissions: z.record(z.string(), z.string()), repositories: z.array(z.object({ id: ProviderId })).length(1) }), data);
      const expires = Date.parse(result.expires_at);
      if (result.repositories[0].id !== repositoryIds[0] || Object.entries(result.permissions).some(([name, level]) => scope[name] !== level)
        || Object.keys(scope).some(name => result.permissions[name] !== "read") || expires > this.now() + 3605000) throw new GitHubAppError("provider_unavailable");
      const credential: InstallationCredential = { token: result.token, expiresAt: result.expires_at,
        assertValid: () => { if (!active || expires - this.now() < 60000) throw new GitHubAppError("access_changed"); } };
      issued = credential;
      credential.assertValid();
      const value = await use(credential);
      credential.assertValid();
      return value;
    } finally {
      active = false;
      if (issued) issued.token = "";
      if (token) {
        try { await this.request("/installation/token", token, "DELETE"); } catch { /* expires upstream; never cache or log */ }
        token = undefined;
      }
    }
  }
  async resolveCommit(token: string, owner: string, name: string, branch: string) {
    const parsed = BranchSchema.safeParse(branch);
    if (!parsed.success) throw new GitHubAppError("invalid_request");
    const data = this.parse(CommitSchema, (await this.request(`${this.repoPath(owner, name)}/git/ref/heads/${encodeURIComponent(branch)}`, token)).data);
    if (data.ref !== `refs/heads/${branch}`) throw new GitHubAppError("access_changed");
    return data.object.sha;
  }
}

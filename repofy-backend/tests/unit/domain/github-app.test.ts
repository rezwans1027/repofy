import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { GitHubVault, digest } from "../../../src/domain/github-app/crypto";
import { GitHubConnectionService } from "../../../src/domain/github-app/service";
import { GitHubConnectionRepository } from "../../../src/domain/github-app/repository";
import { GitHubAppError } from "../../../src/domain/github-app/errors";
import { actor1, actor2, fixtureRepository, MemoryGitHubRpc, SyntheticGitHubProvider, testKey } from "../../helpers/github-app-fixtures";

let clock: number; let db: MemoryGitHubRpc; let provider: SyntheticGitHubProvider; let service: GitHubConnectionService;
const session = (actor = actor1, binding = "session-one") => ({ actor, binding: digest(binding), sessionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" });
beforeEach(() => {
  clock = Date.now(); db = new MemoryGitHubRpc(() => clock); provider = new SyntheticGitHubProvider(() => clock);
  service = new GitHubConnectionService(new GitHubConnectionRepository(db), provider, new GitHubVault(testKey),
    { appId: "42", clientId: "fixture_client", slug: "fixture-app", frontendOrigin: "https://repofy.example" }, () => clock);
});
async function link(actor = actor1, code = "first") {
  const start = await service.start(session(actor), { intent: "link" });
  await service.authorize(session(actor), new URL(start.authorizeUrl).searchParams.get("state")!, code);
  return (await service.accounts(actor)).accounts.at(-1)!.accountId;
}
async function discover(actor = actor1, code = "first") {
  const account = await link(actor, code);
  const installation = (await service.installations(actor, account)).installations[0].installationId;
  const repositories = await service.repositories(actor, account, installation);
  return { account, installation, repository: repositories.repositories[0].repositoryId, repositories };
}

describe("single-use installation flow", () => {
  it("uses PKCE, an encrypted verifier, fixed callbacks and two independent state values", async () => {
    const exchange = vi.spyOn(provider, "exchangeCode");
    const started = await service.start(session(), {}); const url = new URL(started.authorizeUrl);
    expect(url.origin).toBe("https://github.com"); expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.has("scope")).toBe(false);
    expect(url.searchParams.get("redirect_uri")).toBe("https://repofy.example/api/v1/github/installations/authorize");
    const state = url.searchParams.get("state")!;
    expect(JSON.stringify([...db.states.values()])).not.toContain(state);
    const authorized = await service.authorize(session(), state, "first"); const install = new URL(authorized.redirect);
    expect(install.pathname).toBe("/apps/fixture-app/installations/new"); expect(install.searchParams.get("state")).not.toBe(state);
    const verifier = exchange.mock.calls[0][1];
    expect(Buffer.from(digest(verifier), "hex").toString("base64url")).toBe(url.searchParams.get("code_challenge"));
    expect(JSON.stringify(db.calls)).not.toContain(verifier);
    const done = await service.installed(session(), install.searchParams.get("state")!, "500", "install");
    expect(done.redirect).toBe("https://repofy.example/readiness/new?github=connected");
    expect(provider.scopes).toEqual([]); // Discovery never mints installation credentials.
    expect([...db.connections.values()]).toHaveLength(1);
  });
  it.each(["different-user", "different-session", "expired", "forged"])("rejects %s callback before exchanging a code", async mode => {
    const exchange = vi.spyOn(provider, "exchangeCode");
    const start = await service.start(session(), {}); let state = new URL(start.authorizeUrl).searchParams.get("state")!;
    if (mode === "expired") clock += 600001;
    if (mode === "forged") state = "x".repeat(43);
    const identity = mode === "different-user" ? session(actor2) : mode === "different-session" ? session(actor1, "other") : session();
    await expect(service.authorize(identity, state, "first")).rejects.toMatchObject({ code: "invalid_state" });
    expect(exchange).not.toHaveBeenCalled();
  });
  it("rejects concurrent/replayed OAuth callbacks even when the first exchange fails", async () => {
    const start = await service.start(session(), {}); const state = new URL(start.authorizeUrl).searchParams.get("state")!;
    vi.spyOn(provider, "exchangeCode").mockRejectedValue(new GitHubAppError("provider_unavailable"));
    const results = await Promise.allSettled([service.authorize(session(), state, "first"), service.authorize(session(), state, "first")]);
    expect(results.map(result => result.status === "rejected" ? result.reason.code : "bad").sort()).toEqual(["invalid_state", "provider_unavailable"]);
    expect(provider.exchangeCode).toHaveBeenCalledTimes(1);
  });
  it("rejects another user's installation ID and a repeated setup callback", async () => {
    const start = await service.start(session(), {});
    const authorized = await service.authorize(session(), new URL(start.authorizeUrl).searchParams.get("state")!, "first");
    const state = new URL(authorized.redirect).searchParams.get("state")!;
    await expect(service.installed(session(), state, "999", "install")).rejects.toMatchObject({ code: "installation_missing" });
    await expect(service.installed(session(), state, "500", "install")).rejects.toMatchObject({ code: "invalid_state" });
    expect(db.connections.size).toBe(0);
  });
  it("represents pending organization approval without attaching an installation", async () => {
    const start = await service.start(session(), {});
    const auth = await service.authorize(session(), new URL(start.authorizeUrl).searchParams.get("state")!, "first");
    expect((await service.installed(session(), new URL(auth.redirect).searchParams.get("state")!, undefined, "request")).redirect).toContain("pending_approval");
    expect(db.connections.size).toBe(0);
  });
  it("rejects unsafe return destinations and unowned reconnect identities", async () => {
    for (const returnTo of ["https://evil.example", "//evil.example", "/readiness?secret=x", "/callback"]) {
      await expect(service.start(session(), { returnTo })).rejects.toMatchObject({ code: "invalid_request" });
    }
    await expect(service.start(session(), { accountId: randomUUID() })).rejects.toMatchObject({ code: "not_found" });
    expect(db.states.size).toBe(0);
  });
});
describe("verified identity and repository authorization", () => {
  it("supports multiple explicitly linked identities and rejects cross-account conflicts", async () => {
    const first = await link(); await link(actor1, "second");
    expect((await service.accounts(actor1)).accounts).toHaveLength(2);
    await expect(link(actor2)).rejects.toMatchObject({ code: "identity_conflict" });
    const started = await service.start(session(), { accountId: first });
    await expect(service.authorize(session(), new URL(started.authorizeUrl).searchParams.get("state")!, "second")).rejects.toMatchObject({ code: "identity_conflict" });
  });
  it("keeps private names scoped to user-visible repositories in a shared organization", async () => {
    const one = await discover(); const two = await discover(actor2, "second");
    expect(one.repositories.repositories.map(item => item.fullName)).toEqual(["fixture-org/synthetic-private-300"]);
    expect(two.repositories.repositories.map(item => item.fullName)).toEqual(["fixture-org/synthetic-private-301"]);
    await expect(service.resolveCommit(actor2, two.account, one.installation, one.repository, "main")).rejects.toMatchObject({ code: "not_found" });
    await expect(service.repositories(actor2, one.account, one.installation)).rejects.toMatchObject({ code: "not_found" });
    expect(provider.scopes).toEqual([]);
    const serialized = JSON.stringify(db.calls);
    expect(serialized).not.toContain("synthetic-private"); expect(serialized).not.toContain("fixture_user");
  });
  it("resolves an exact branch SHA only after live access checks and narrows token scope", async () => {
    const item = await discover();
    expect(await service.resolveCommit(actor1, item.account, item.installation, item.repository, "main")).toEqual({
      repositoryId: item.repository, providerRepositoryId: "300", branch: "main", commitSha: "a".repeat(40),
    });
    expect(provider.scopes).toEqual([{ installation: "500", repositoryIds: ["300"], permissions: ["contents"] }]);
    expect(JSON.stringify(db.calls)).not.toContain("fixture_installation_ephemeral");
    provider.access.get("fixture_user100")!.set("500", []);
    await expect(service.resolveCommit(actor1, item.account, item.installation, item.repository, "main")).rejects.toMatchObject({ code: "installation_missing" });
    expect(provider.scopes).toHaveLength(1);
  });
  it("handles rename through rediscovery and rejects transferred or substituted repository identities", async () => {
    const item = await discover(); provider.repositories.get("300")!.name = "renamed";
    await expect(service.resolveCommit(actor1, item.account, item.installation, item.repository, "main")).rejects.toThrow();
    const fresh = await service.repositories(actor1, item.account, item.installation);
    expect(fresh.repositories[0].repositoryId).toBe(item.repository);
    expect((await service.resolveCommit(actor1, item.account, item.installation, item.repository, "main")).commitSha).toHaveLength(40);
    provider.repositories.get("300")!.owner.id = "201";
    await expect(service.resolveCommit(actor1, item.account, item.installation, item.repository, "main")).rejects.toMatchObject({ code: "access_changed" });
    expect((await service.repositories(actor1, item.account, item.installation)).issues).toEqual(["access_changed"]);
    expect(provider.scopes).toHaveLength(1);
  });
  it.each(["installation_suspended", "insufficient_permissions", "installation_missing", "reconnect_required", "rate_limited", "provider_unavailable"] as const)("reports %s without names or a public-search fallback", async issue => {
    const item = await discover();
    if (issue === "installation_suspended") provider.installations.get("500")!.suspended_at = new Date(clock).toISOString();
    else if (issue === "insufficient_permissions") delete provider.installations.get("500")!.permissions.contents;
    else if (issue === "installation_missing") provider.installations.clear();
    else provider.failure = new GitHubAppError(issue, issue === "rate_limited" ? 61 : undefined);
    const result = await service.repositories(actor1, item.account, item.installation);
    expect(result).toMatchObject({ status: "unavailable", repositories: [], issues: [issue] });
    expect(JSON.stringify(result)).not.toContain("synthetic-private"); expect(provider.scopes).toEqual([]);
  });
  it("reports optional permissions accurately and declines ungranted token capabilities", async () => {
    const item = await discover();
    expect((await service.installations(actor1, item.account)).installations[0].permissions).toEqual({ contents: "read", pullRequests: "read", actions: "none", checks: "none", commitStatuses: "none" });
    await expect(service.withVerifiedRepositoryToken(actor1, item.account, item.installation, item.repository, ["checks"], async () => true)).rejects.toMatchObject({ code: "insufficient_permissions" });
    expect(provider.scopes).toEqual([]);
  });
  it("binds opaque cursors to actor, account, installation, page size and expiry", async () => {
    const item = await discover(); provider.access.get("fixture_user100")!.set("500", ["300", "301"]);
    const first = await service.repositories(actor1, item.account, item.installation, undefined, 1);
    expect(first.status).toBe("partial"); expect(first.nextCursor).toBeTruthy();
    const last = await service.repositories(actor1, item.account, item.installation, first.nextCursor!);
    expect(last.status).toBe("complete"); expect(last.repositories[0].fullName).toContain("301");
    await expect(service.repositories(actor1, item.account, item.installation, first.nextCursor!, 2)).rejects.toMatchObject({ code: "invalid_request" });
    await expect(service.installations(actor1, item.account, first.nextCursor!)).rejects.toMatchObject({ code: "invalid_request" });
    await expect(service.repositories(actor2, item.account, item.installation, first.nextCursor!)).rejects.toMatchObject({ code: "invalid_request" });
    clock += 600001;
    await expect(service.repositories(actor1, item.account, item.installation, first.nextCursor!)).rejects.toMatchObject({ code: "invalid_request" });
  });
  it("rejects expired, revoked and mismatched identity credentials", async () => {
    const item = await discover();
    provider.users.set("fixture_user100", { id: "999", login: "forged" });
    expect((await service.repositories(actor1, item.account, item.installation)).issues).toEqual(["identity_conflict"]);
    provider.users.delete("fixture_user100");
    expect((await service.repositories(actor1, item.account, item.installation)).issues).toEqual(["reconnect_required"]);
    clock += 28800001;
    expect((await service.accounts(actor1)).accounts[0].status).toBe("reconnect_required");
    expect((await service.repositories(actor1, item.account, item.installation)).issues).toEqual(["reconnect_required"]);
  });
  it("unlink removes local authorization and fences an in-flight provider response", async () => {
    const item = await discover(); const original = provider.getRepository.bind(provider);
    vi.spyOn(provider, "getRepository").mockImplementation(async (...args) => {
      const response = await original(...args); await service.unlink(actor1, item.account); return response;
    });
    await expect(service.resolveCommit(actor1, item.account, item.installation, item.repository, "main")).rejects.toMatchObject({ code: "reconnect_required" });
    expect(provider.scopes).toEqual([]); expect(db.connections.size).toBe(0); expect(db.discoveries.size).toBe(0);
    expect((await service.accounts(actor1)).accounts[0].status).toBe("unlinked");
  });
  it("an unlink also cancels a consumed OAuth callback before a delayed identity exchange completes", async () => {
    const account = await link();
    const pending = await service.start(session(), { accountId: account, intent: "link" });
    const state = new URL(pending.authorizeUrl).searchParams.get("state")!;
    const exchange = provider.exchangeCode.bind(provider);
    vi.spyOn(provider, "exchangeCode").mockImplementation(async code => {
      await service.unlink(actor1, account); return exchange(code);
    });
    await expect(service.authorize(session(), state, "first")).rejects.toMatchObject({ code: "invalid_state" });
    expect((await service.accounts(actor1)).accounts[0].status).toBe("unlinked");
  });
});
it("rejects context-swapped or tampered ciphertext without exposing its content", () => {
  const vault = new GitHubVault(testKey); const encrypted = vault.seal({ secret: "synthetic" }, "actor-one");
  expect(vault.open(encrypted, "actor-one")).toEqual({ secret: "synthetic" });
  expect(() => vault.open(encrypted, "actor-two")).toThrow("Reconnect");
  expect(() => vault.open(encrypted.slice(0, -5) + "BAD", "actor-one")).toThrow("Reconnect");
  expect(() => new GitHubVault("invalid")).toThrow("temporarily unavailable");
});

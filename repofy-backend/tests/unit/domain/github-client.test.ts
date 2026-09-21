import { beforeEach, expect, it, vi } from "vitest";
import { generateKeyPairSync, verify } from "node:crypto";
import { GitHubHttpClient } from "../../../src/domain/github-app/client";
import { ProviderId } from "../../../src/domain/github-app/provider";
import { fixtureInstallation, fixtureRepository } from "../../helpers/github-app-fixtures";

const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
const pem = keys.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const now = Date.now();
let fetcher: ReturnType<typeof vi.fn>; let client: GitHubHttpClient;
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers });
const token = () => ({ token: "fixture_installation_secret", expires_at: new Date(now + 3600000).toISOString(), permissions: { contents: "read", metadata: "read" }, repositories: [{ id: 300 }] });
beforeEach(() => {
  fetcher = vi.fn();
  client = new GitHubHttpClient({ appId: "42", clientId: "fixture_client", clientSecret: "fixture_oauth_secret", privateKey: () => pem }, fetcher as typeof fetch, () => now);
});
it("signs a verifiable RS256 JWT and checks app/installation identity", async () => {
  fetcher.mockResolvedValue(json(fixtureInstallation()));
  expect((await client.getInstallation("500")).id).toBe("500");
  const [url, request] = fetcher.mock.calls[0]; const jwt = request.headers.Authorization.slice(7); const [header, body, signature] = jwt.split(".");
  expect(url).toBe("https://api.github.com/app/installations/500");
  expect(verify("RSA-SHA256", Buffer.from(`${header}.${body}`), keys.publicKey, Buffer.from(signature, "base64url"))).toBe(true);
  expect(JSON.parse(Buffer.from(body, "base64url").toString())).toEqual({ iss: "fixture_client", iat: Math.floor(now / 1000) - 60, exp: Math.floor(now / 1000) + 540 });
  expect(request.redirect).toBe("manual"); expect(request.headers["X-GitHub-Api-Version"]).toBe("2026-03-10");
  fetcher.mockResolvedValue(json({ ...fixtureInstallation(), app_id: "43" }));
  await expect(client.getInstallation("500")).rejects.toMatchObject({ code: "installation_missing" });
});
it("exchanges a PKCE code without OAuth scopes or persistence of refresh tokens", async () => {
  fetcher.mockResolvedValue(json({ access_token: "fixture_user_secret", token_type: "bearer", scope: "", expires_in: 28800, refresh_token: "must_discard" }));
  expect(await client.exchangeCode("code", "verifier", "https://repofy.example/api/v1/github/installations/authorize")).toEqual({ token: "fixture_user_secret", expiresAt: new Date(now + 28800000).toISOString() });
  expect(fetcher.mock.calls[0][1].headers.Accept).toBe("application/json");
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ client_id: "fixture_client", client_secret: "fixture_oauth_secret", code: "code", code_verifier: "verifier", redirect_uri: "https://repofy.example/api/v1/github/installations/authorize" });
  fetcher.mockResolvedValue(json({ error: "bad_code", error_description: "private-sentinel" }));
  await expect(client.exchangeCode("bad", "verifier", "https://repofy.example")).rejects.toThrow("GitHub is temporarily unavailable");
});
it("lists only user-accessible installation repositories with bounded local pagination", async () => {
  fetcher.mockResolvedValue(json({ total_count: 2, repositories: [fixtureRepository()] }, 200, { link: '<https://evil.example/steal>; rel="next"' }));
  const result = await client.listRepositories("user", "500", 1, 1);
  expect(result.hasNext).toBe(true); expect(result.items[0].id).toBe("300");
  expect(fetcher).toHaveBeenCalledTimes(1); expect(fetcher.mock.calls[0][0]).toBe("https://api.github.com/user/installations/500/repositories?per_page=1&page=1");
  expect(fetcher.mock.calls[0][1].headers.Authorization).toBe("Bearer user");
  await expect(client.listRepositories("user", "500", 0, 100)).rejects.toThrow();
  await expect(client.listRepositories("user", "500", 1, 101)).rejects.toThrow();
  await expect(client.listRepositories("user", "500", 10001, 1)).rejects.toThrow();
});
it("mints exactly one repository with only requested read permissions, then revokes and invalidates it", async () => {
  fetcher.mockResolvedValueOnce(json(token())).mockResolvedValueOnce(new Response(null, { status: 204 }));
  let captured: { token: string; assertValid(): void } | undefined;
  expect(await client.withInstallationToken("500", ["300"], ["contents"], async credential => { captured = credential; return "done"; })).toBe("done");
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ repository_ids: [300], permissions: { metadata: "read", contents: "read" } });
  expect(fetcher.mock.calls[1][0]).toBe("https://api.github.com/installation/token"); expect(fetcher.mock.calls[1][1].method).toBe("DELETE");
  expect(() => captured!.assertValid()).toThrow("access or ownership changed");
  expect(captured!.token).toBe("");
  await expect(client.withInstallationToken("500", [], ["contents"], async () => true)).rejects.toThrow();
  await expect(client.withInstallationToken("500", ["300", "301"], ["contents"], async () => true)).rejects.toThrow();
});
it.each(["extra-repo", "wrong-repo", "write", "missing-permission", "expired", "excess-expiry"])("rejects %s token response before use and attempts cleanup", async variant => {
  const response = token();
  if (variant === "extra-repo") response.repositories.push({ id: 301 });
  if (variant === "wrong-repo") response.repositories[0].id = 301;
  if (variant === "write") response.permissions.contents = "write";
  if (variant === "missing-permission") delete (response.permissions as Partial<typeof response.permissions>).contents;
  if (variant === "expired") response.expires_at = new Date(now + 59000).toISOString();
  if (variant === "excess-expiry") response.expires_at = new Date(now + 7200000).toISOString();
  fetcher.mockResolvedValueOnce(json(response)).mockResolvedValueOnce(new Response(null, { status: 204 }));
  const use = vi.fn(); await expect(client.withInstallationToken("500", ["300"], ["contents"], use)).rejects.toThrow();
  expect(use).not.toHaveBeenCalled(); expect(fetcher).toHaveBeenCalledTimes(2);
});
it("drops tokens after consumer errors and tolerates upstream revocation failure without caching", async () => {
  fetcher.mockResolvedValueOnce(json(token())).mockRejectedValueOnce(new Error("private-sentinel"));
  await expect(client.withInstallationToken("500", ["300"], ["contents"], async () => { throw new Error("consumer failed"); })).rejects.toThrow("consumer failed");
  fetcher.mockResolvedValueOnce(json(token())).mockResolvedValueOnce(new Response(null, { status: 204 }));
  await client.withInstallationToken("500", ["300"], ["contents"], async () => true);
  expect(fetcher.mock.calls.filter(call => call[1].method === "POST")).toHaveLength(2);
});
it.each([[401, "reconnect_required"], [403, "insufficient_permissions"], [404, "installation_missing"], [301, "access_changed"], [422, "access_changed"], [502, "provider_unavailable"]] as const)("sanitizes HTTP %s", async (status, code) => {
  fetcher.mockResolvedValue(json({ message: "secret-sentinel", token: "never-echo" }, status, { location: "https://evil.example" }));
  await expect(client.getUser("token-sentinel")).rejects.toMatchObject({ code });
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it.each([[429, { "retry-after": "99" }, 99], [403, { "x-ratelimit-remaining": "0", "x-ratelimit-reset": String(Math.floor(now / 1000) + 120) }, 120], [403, { "retry-after": "invalid" }, 60]] as const)("handles rate limits %s without retry storms", async (status, headers, seconds) => {
  fetcher.mockResolvedValue(json({}, status, headers));
  const error = await client.getUser("token").catch(error => error);
  expect(error.code).toBe("rate_limited"); expect(error.retryAfterSeconds).toBeGreaterThanOrEqual(seconds - 1); expect(error.retryAfterSeconds).toBeLessThanOrEqual(seconds);
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("rejects unbounded/malformed data and network failures with safe errors", async () => {
  for (const body of ["invalid json secret-sentinel", JSON.stringify({ payload: "x".repeat(2 * 1024 * 1024) }), JSON.stringify({ id: 9007199254740992, login: "fixture" })]) {
    fetcher.mockResolvedValue(new Response(body)); await expect(client.getUser("token")).rejects.toThrow("temporarily unavailable");
  }
  fetcher.mockRejectedValue(new Error("network URL token-sentinel")); await expect(client.getUser("token")).rejects.toThrow("temporarily unavailable");
  expect(ProviderId.parse("18446744073709551615")).toBe("18446744073709551615");
  expect(ProviderId.safeParse(9007199254740992).success).toBe(false);
});
it("resolves the exact branch ref and rejects unsafe/mismatched refs", async () => {
  fetcher.mockResolvedValue(json({ ref: "refs/heads/feature/test", object: { type: "commit", sha: "a".repeat(40) } }));
  expect(await client.resolveCommit("token", "fixture", "repo", "feature/test")).toBe("a".repeat(40));
  expect(fetcher.mock.calls[0][0]).toContain("/git/ref/heads/feature%2Ftest");
  for (const branch of ["../main", "-bad..ref", "main.lock", "a b", "main@{0}", "/main"]) await expect(client.resolveCommit("token", "fixture", "repo", branch)).rejects.toThrow();
  fetcher.mockResolvedValue(json({ ref: "refs/heads/feature/test", object: { type: "commit", sha: "a".repeat(40) } }));
  await expect(client.resolveCommit("token", "fixture", "repo", "main")).rejects.toMatchObject({ code: "access_changed" });
});
it("rejects invalid private keys before making a request", async () => {
  const bad = new GitHubHttpClient({ appId: "42", clientId: "client", clientSecret: "secret", privateKey: () => "private-sentinel" }, fetcher as typeof fetch);
  await expect(bad.getInstallation("500")).rejects.toThrow("temporarily unavailable"); expect(fetcher).not.toHaveBeenCalled();
});

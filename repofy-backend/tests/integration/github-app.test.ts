import { beforeEach, expect, it, vi } from "vitest";
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import { DISABLED_FEATURE_FLAGS, GitHubRepositoriesResponseSchema } from "@repofy/contracts";
import { createFeatureOneRoutes } from "../../src/routes/feature-one.routes";
import { createApp } from "../../src/app";
import { v1Errors } from "../../src/middleware/v1-errors";
import { csrfProtection } from "../../src/middleware/csrf";
import { getSupabaseAdmin } from "../../src/config/supabase";
import { GitHubVault } from "../../src/domain/github-app/crypto";
import { GitHubConnectionRepository } from "../../src/domain/github-app/repository";
import { GitHubConnectionService } from "../../src/domain/github-app/service";
import { logger } from "../../src/lib/logger";
import { actor1, actor2, MemoryGitHubRpc, SyntheticGitHubProvider, testKey } from "../helpers/github-app-fixtures";

vi.mock("../../src/config/supabase", () => ({ getSupabaseAdmin: vi.fn() }));
vi.mock("../../src/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
const sessionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
function jwt(actor = actor1, session = sessionId, extra = {}) {
  return `header.${Buffer.from(JSON.stringify({ sub: actor, session_id: session, ...extra })).toString("base64url")}.verified_by_auth_mock`;
}
let getUser: ReturnType<typeof vi.fn>; let authRpc: ReturnType<typeof vi.fn>; let db: MemoryGitHubRpc; let provider: SyntheticGitHubProvider;
let service: GitHubConnectionService;
beforeEach(() => {
  vi.clearAllMocks(); db = new MemoryGitHubRpc(); provider = new SyntheticGitHubProvider();
  getUser = vi.fn(async token => {
    try { return { data: { user: { id: JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()).sub } }, error: null }; }
    catch { return { data: { user: null }, error: { message: "invalid" } }; }
  });
  authRpc = vi.fn().mockResolvedValue({ data: true, error: null });
  vi.mocked(getSupabaseAdmin).mockReturnValue({ auth: { getUser }, rpc: authRpc } as unknown as ReturnType<typeof getSupabaseAdmin>);
  service = new GitHubConnectionService(new GitHubConnectionRepository(db), provider, new GitHubVault(testKey),
    { appId: "42", clientId: "fixture-client", slug: "fixture-app", frontendOrigin: "https://repofy.example" });
});
function app() {
  const application = express();
  application.use((_req, res, next) => { res.locals.apiVersion = "v1"; res.locals.requestId = "github-test"; res.setHeader("Cache-Control", "private, no-store"); next(); });
  application.use(cookieParser(), express.json(), csrfProtection);
  application.use("/api/v1", createFeatureOneRoutes({ ...DISABLED_FEATURE_FLAGS, featureOneEnabled: true, githubAppRepositoriesEnabled: true }, () => service));
  application.use(v1Errors); return application;
}
const cookieFrom = (response: request.Response) => response.headers["set-cookie"][0].split(";")[0];
async function connect(application = app(), token = jwt()) {
  const start = await request(application).post("/api/v1/github/installations/start").set("Authorization", `Bearer ${token}`).send({});
  expect(start.status).toBe(200); const cookie = cookieFrom(start);
  const state = new URL(start.body.data.authorizeUrl).searchParams.get("state")!;
  const auth = await request(application).get("/api/v1/github/installations/authorize").query({ state, code: "first" }).set("Authorization", `Bearer ${token}`).set("Cookie", cookie);
  expect(auth.status).toBe(303);
  return { application, cookie, state: new URL(auth.headers.location).searchParams.get("state")! };
}
it.each(["/github/installations/start", "/github/installations/authorize", "/github/installations/callback", "/github/installations", "/github/accounts", "/repositories"])("gates %s before authentication or provider calls", async path => {
  const fetcher = vi.spyOn(globalThis, "fetch");
  const response = path.endsWith("start") ? await request(createApp()).post(`/api/v1${path}`).send({}) : await request(createApp()).get(`/api/v1${path}`);
  expect(response.status).toBe(503); expect(response.body.code).toBe("FEATURE_DISABLED"); expect(getUser).not.toHaveBeenCalled(); expect(fetcher).not.toHaveBeenCalled();
});
it("requires fresh verified sessions, rejects claims without a session and retains callback recovery", async () => {
  const application = app();
  expect((await request(application).post("/api/v1/github/installations/start").send({})).status).toBe(401);
  getUser.mockResolvedValue({ data: { user: { id: actor1 } }, error: { message: "invalid-signature" } });
  expect((await request(application).post("/api/v1/github/installations/start").set("Authorization", `Bearer ${jwt()}`).send({})).status).toBe(401);
  getUser.mockResolvedValue({ data: { user: { id: actor1 } }, error: null });
  expect((await request(application).get("/api/v1/github/accounts").set("Authorization", `Bearer ${jwt(actor1, undefined, { session_id: null })}`)).status).toBe(401);
  expect((await request(application).get("/api/v1/github/accounts").set("Authorization", `Bearer ${jwt(actor2)}`)).status).toBe(401);
  expect(db.calls).toHaveLength(0);
});
it("completes an installation flow and returns private, validated repository references", async () => {
  const { application, state, cookie } = await connect();
  const complete = await request(application).get("/api/v1/github/installations/callback").query({ state, installation_id: "500", setup_action: "install" }).set("Authorization", `Bearer ${jwt()}`).set("Cookie", cookie);
  expect(complete.status).toBe(303); expect(complete.headers.location).toBe("https://repofy.example/readiness/new?github=connected");
  expect(complete.headers["referrer-policy"]).toBe("no-referrer");
  const accounts = await request(application).get("/api/v1/github/accounts").set("Authorization", `Bearer ${jwt()}`);
  const accountId = accounts.body.data.accounts[0].accountId;
  const installations = await request(application).get("/api/v1/github/installations").query({ accountId }).set("Authorization", `Bearer ${jwt()}`);
  const installationId = installations.body.data.installations[0].installationId;
  const repositories = await request(application).get("/api/v1/repositories").query({ accountId, installationId }).set("Authorization", `Bearer ${jwt()}`);
  expect(repositories.status).toBe(200); expect(GitHubRepositoriesResponseSchema.parse(repositories.body.data).repositories).toHaveLength(1);
  expect(repositories.headers["cache-control"]).toBe("private, no-store");
  expect(repositories.text).not.toContain("fixture_user"); expect(repositories.text).not.toContain("providerRepositoryId"); expect(repositories.text).not.toContain("privateKey");
  const foreign = await request(application).get("/api/v1/repositories").query({ accountId, installationId }).set("Authorization", `Bearer ${jwt(actor2)}`);
  expect(foreign.status).toBe(404); expect(foreign.text).not.toContain("synthetic-private");
  expect((await request(application).post("/api/v1/analyses").set("Authorization", `Bearer ${jwt()}`).send({})).status).toBe(501);
});
it.each(["missing-cookie", "different-session", "different-user", "replay", "forged-id"])("rejects %s on the setup callback", async mode => {
  const { application, state, cookie } = await connect();
  const callback = (token = jwt(), useCookie = cookie, installation = "500") => request(application).get("/api/v1/github/installations/callback")
    .query({ state, installation_id: installation }).set("Authorization", `Bearer ${token}`).set("Cookie", useCookie);
  if (mode === "replay") expect((await callback()).status).toBe(303);
  const token = mode === "different-user" ? jwt(actor2) : mode === "different-session" ? jwt(actor1, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb") : jwt();
  const response = await callback(token, mode === "missing-cookie" ? "unrelated=1" : cookie, mode === "forged-id" ? "999" : "500");
  expect(response.status).toBe(mode === "forged-id" ? 404 : 400);
});
it("accepts a refreshed access JWT only when it retains the same verified session", async () => {
  const { application, state, cookie } = await connect();
  const response = await request(application).get("/api/v1/github/installations/callback").query({ state, installation_id: "500" })
    .set("Authorization", `Bearer ${jwt(actor1, sessionId, { iat: 98765 })}`).set("Cookie", cookie);
  expect(response.status).toBe(303);
});
it("rejects signed-out sessions even when the access JWT still verifies", async () => {
  const { application, state, cookie } = await connect();
  authRpc.mockResolvedValue({ data: false, error: null });
  const response = await request(application).get("/api/v1/github/installations/callback").query({ state, installation_id: "500" })
    .set("Authorization", `Bearer ${jwt()}`).set("Cookie", cookie);
  expect(response.status).toBe(401); expect(db.connections.size).toBe(0);
  expect(authRpc).toHaveBeenLastCalledWith("feature_one_github_active_session", { p_actor: actor1, p_session: sessionId });
});
it("rejects cookie-authenticated CSRF and malformed requests before changing connection state", async () => {
  const application = app();
  expect((await request(application).post("/api/v1/github/installations/start").set("Cookie", `access_token=${jwt()}`).send({})).status).toBe(403);
  expect((await request(application).post("/api/v1/github/installations/start").set("Authorization", `Bearer ${jwt()}`).send({ returnTo: "https://evil.example", userId: actor2 })).status).toBe(400);
  for (const query of [{ accountId: actor1, perPage: "101" }, { accountId: actor1, perPage: "0" }, { accountId: actor1, actor: actor2 }, { accountId: "bad" }]) {
    expect((await request(application).get("/api/v1/github/installations").query(query).set("Authorization", `Bearer ${jwt()}`)).status).toBe(400);
  }
  expect(db.calls).toHaveLength(0);
});
it("sanitizes raw provider/database failures and keeps secrets out of logs", async () => {
  const { application, state, cookie } = await connect();
  vi.spyOn(provider, "getUser").mockRejectedValue(new Error("private-source token-sentinel"));
  const response = await request(application).get("/api/v1/github/installations/callback").query({ state, installation_id: "500" }).set("Authorization", `Bearer ${jwt()}`).set("Cookie", cookie);
  expect(response.status).toBe(500); expect(response.text).not.toContain("sentinel");
  expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toContain("sentinel");
});

it('returns browser callback failures to the picker without exposing provider data or accepting a return URL', async () => {
  const { application, cookie } = await connect();
  const response = await request(application).get('/api/v1/github/installations/callback')
    .query({ state: 'a'.repeat(43), installation_id: '500' }).set('Authorization', `Bearer ${jwt()}`)
    .set('Cookie', cookie).set('Accept', 'text/html');
  expect(response.status).toBe(303);
  expect(response.headers.location).toBe('/readiness/new?github=invalid_state');
  expect(response.headers['set-cookie'][0]).toContain('repofy_github_connection=;');
});
it('sends signed-out browser callbacks to sign-in while API requests retain 401', async () => {
  const application = app();
  const browser = await request(application).get('/api/v1/github/installations/callback').set('Accept', 'text/html');
  expect(browser.status).toBe(303); expect(browser.headers.location).toBe('/login');
  expect((await request(application).get('/api/v1/github/installations/callback').set('Accept', 'application/json')).status).toBe(401);
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { ApiErrorEnvelopeSchema, ClientCapabilitiesSchema, DISABLED_FEATURE_FLAGS } from "@repofy/contracts";
import { createApp } from "../../src/app";
import { createFeatureOneRoutes } from "../../src/routes/feature-one.routes";
import { getSupabaseAdmin } from "../../src/config/supabase";
import { logger } from "../../src/lib/logger";

vi.mock("../../src/config/supabase", () => ({ getSupabaseAdmin: vi.fn() }));
vi.mock("../../src/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

const paths = [
  ["get", "/analyses"], ["post", "/analyses"], ["get", "/analyses/job"],
  ["post", "/analyses/job/cancel"], ["get", "/analyses/job/evidence"], ["get", "/analyses/job/readiness"],
  ["post", "/analyses/job/rescan"], ["post", "/analyses/job/feedback"], ["delete", "/analyses/job"],
  ["get", "/repositories"], ["post", "/repositories/selection"], ["delete", "/repositories/repo"],
  ["get", "/github/installations"], ["post", "/github/installations/link"],
  ["get", "/readiness-reports/report"], ["get", "/readiness-reports/report/evidence"],
] as const;

const ownerRoutes = new Set(["get /analyses", "get /analyses/job", "post /analyses/job/cancel", "delete /analyses/job", "get /readiness-reports/report", "get /readiness-reports/report/evidence"]);
describe("disabled Feature 1 boundary", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(paths)("%s %s performs no external work", async (method, path) => {
    const external = vi.spyOn(globalThis, "fetch");
    const app = createApp();
    const response = await request(app)[method](`/api/v1${path}`).set("X-Request-Id", "synthetic-correlation-id")
      .set("Cookie", "access_token=synthetic-forged-cookie").set("X-Requested-With", "XMLHttpRequest");
    const owner = ownerRoutes.has(`${method} ${path}`);
    expect(response.status).toBe(owner ? 401 : 503);
    expect(ApiErrorEnvelopeSchema.parse(response.body)).toMatchObject({ code: owner ? "UNAUTHENTICATED" : "FEATURE_DISABLED", retryable: false, requestId: "synthetic-correlation-id" });
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.headers["x-request-id"]).toBe(response.body.requestId);
    expect(external).not.toHaveBeenCalled();
    if (!owner) expect(getSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("returns only safe capabilities anonymously and keeps legacy analyzer disabled", async () => {
    const app = createApp();
    const response = await request(app).get("/api/v1/capabilities");
    expect(response.status).toBe(200);
    expect(ClientCapabilitiesSchema.parse(response.body.data)).toEqual({
      contractVersion: "1.0.0", features: DISABLED_FEATURE_FLAGS, readinessAvailability: "disabled",
    });
    const legacy = await request(app).post("/api/analyze/synthetic");
    expect(legacy.status).toBe(404);
    expect(legacy.body).toEqual({ success: false, error: "Not found" });
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("preserves CSRF protection and adds error metadata", async () => {
    const response = await request(createApp()).post("/api/v1/analyses").set("Cookie", "access_token=synthetic");
    expect(response.status).toBe(403);
    expect(ApiErrorEnvelopeSchema.parse(response.body).code).toBe("FORBIDDEN");
  });

  it("does not echo or log malformed input or supplied secrets", async () => {
    const response = await request(createApp()).post("/api/v1/analyses").set("Content-Type", "application/json")
      .send('{"synthetic-secret-sentinel": invalid}');
    expect(response.status).toBe(400);
    expect(ApiErrorEnvelopeSchema.parse(response.body).code).toBe("INVALID_REQUEST");
    expect(JSON.stringify(response.body)).not.toContain("sentinel");
    expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toContain("sentinel");
    expect(logger.error).toHaveBeenCalledWith("Feature 1 request failed", expect.objectContaining({ contractVersion: "1.0.0", status: 400 }));
  });
});

describe("enabled flags cannot enable unfinished handlers", () => {
  it.each(paths.filter(([method, path]) => !(method === "get" && ["/repositories", "/github/installations"].includes(path))))("%s %s remains unimplemented", async (method, path) => {
    const app = express();
    app.use((_req, res, next) => { res.locals.apiVersion = "v1"; res.locals.requestId = "synthetic"; next(); });
    app.use("/api/v1", createFeatureOneRoutes({ featureOneEnabled: true, githubAppRepositoriesEnabled: true, rescansEnabled: true, findingFeedbackEnabled: true }));
    const response = await request(app)[method](`/api/v1${path}`);
    const auth = ownerRoutes.has(`${method} ${path}`) || path === "/analyses";
    expect(response.status).toBe(auth ? 401 : 501);
    expect(response.body.code).toBe(auth ? "UNAUTHENTICATED" : "FEATURE_NOT_IMPLEMENTED");
  });

  it.each(["/repositories", "/github/installations/link", "/analyses/job/rescan", "/analyses/job/feedback"])("enforces the child switch at %s", async (path) => {
    const app = express();
    app.use((_req, res, next) => { res.locals.apiVersion = "v1"; res.locals.requestId = "synthetic"; next(); });
    app.use("/api/v1", createFeatureOneRoutes({ ...DISABLED_FEATURE_FLAGS, featureOneEnabled: true }));
    expect((await request(app).post(`/api/v1${path}`)).body.code).toBe("FEATURE_DISABLED");
  });
});

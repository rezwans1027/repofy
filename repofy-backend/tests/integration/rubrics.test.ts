import { beforeEach, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { DISABLED_FEATURE_FLAGS, RubricDiscoveryResponseSchema } from "@repofy/contracts";
import { createApp } from "../../src/app";
import { createFeatureOneRoutes } from "../../src/routes/feature-one.routes";
import { clearTokenCache } from "../../src/middleware/auth";
import { v1Errors } from "../../src/middleware/v1-errors";
import { getSupabaseAdmin } from "../../src/config/supabase";
import { initialRubricCatalog } from "../../src/domain/rubrics/catalog";
import { logger } from "../../src/lib/logger";

vi.mock("../../src/config/supabase", () => ({ getSupabaseAdmin: vi.fn() }));
vi.mock("../../src/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
const actor = "00000000-0000-4000-8000-000000000001";
const rpc = vi.fn(); const getUser = vi.fn();
beforeEach(() => {
  vi.clearAllMocks(); clearTokenCache();
  rpc.mockResolvedValue({ data: initialRubricCatalog, error: null });
  getUser.mockResolvedValue({ data: { user: { id: actor } }, error: null });
  vi.mocked(getSupabaseAdmin).mockReturnValue({ auth: { getUser }, rpc,
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
  } as unknown as ReturnType<typeof getSupabaseAdmin>);
});
function enabled() {
  const app = express();
  app.use((_req, res, next) => {
    res.locals.apiVersion = "v1"; res.locals.requestId = "rubric-fixture";
    res.setHeader("Cache-Control", "private, no-store"); next();
  });
  app.use("/api/v1", createFeatureOneRoutes({ ...DISABLED_FEATURE_FLAGS, featureOneEnabled: true }));
  app.use(v1Errors);
  return app;
}
it.each(["/role-rubrics", "/role-rubrics/readiness_1_0_0"])("keeps disabled discovery at %s free of external work", async path => {
  const response = await request(createApp()).get(`/api/v1${path}`).set("Authorization", "Bearer fake");
  expect(response.status).toBe(503); expect(response.body.code).toBe("FEATURE_DISABLED");
  expect(response.headers["cache-control"]).toBe("private, no-store");
  expect(getSupabaseAdmin).not.toHaveBeenCalled();
});
it("requires a verified session before active or historical discovery", async () => {
  for (const path of ["/role-rubrics", "/role-rubrics/readiness_1_0_0"]) {
    expect((await request(enabled()).get(`/api/v1${path}`)).status).toBe(401);
  }
  expect(getSupabaseAdmin).not.toHaveBeenCalled();
  getUser.mockResolvedValue({ data: { user: null }, error: { message: "invalid" } });
  expect((await request(enabled()).get("/api/v1/role-rubrics").set("Authorization", "Bearer invalid")).status).toBe(401);
  expect(rpc).not.toHaveBeenCalled();
});
it("discovers the database's active release and immutable historical release with explicit limitations", async () => {
  for (const suffix of ["", "/readiness_1_0_0"]) {
    const response = await request(enabled()).get(`/api/v1/role-rubrics${suffix}`).set("Authorization", "Bearer valid");
    expect(response.status).toBe(200);
    expect(RubricDiscoveryResponseSchema.parse(response.body.data)).toEqual(initialRubricCatalog);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(rpc).toHaveBeenLastCalledWith("feature_one_read_rubric_catalog", { p_actor: actor, p_release_id: suffix ? "readiness_1_0_0" : null });
  }
  const capabilities = await request(enabled()).get("/api/v1/capabilities");
  expect(capabilities.body.data.readinessAvailability).toBe("available");
});
it("fails safely for an unseeded database, an unknown release and a provider error", async () => {
  rpc.mockResolvedValue({ data: null, error: null });
  expect((await request(enabled()).get("/api/v1/role-rubrics").set("Authorization", "Bearer valid")).status).toBe(503);
  expect((await request(enabled()).get("/api/v1/role-rubrics/absent").set("Authorization", "Bearer valid")).status).toBe(404);
  rpc.mockResolvedValue({ data: null, error: { message: "private-sentinel" } });
  const response = await request(enabled()).get("/api/v1/role-rubrics").set("Authorization", "Bearer valid");
  expect(response.status).toBe(500); expect(response.body.code).toBe("INTERNAL_ERROR");
  expect(JSON.stringify(response.body)).not.toContain("sentinel");
  expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toContain("sentinel");
});
it("rejects unknown query inputs, malformed release keys and mutation methods", async () => {
  for (const path of ["/role-rubrics?actor=foreign", "/role-rubrics/INVALID"])
    expect((await request(enabled()).get(`/api/v1${path}`).set("Authorization", "Bearer valid")).status).toBe(400);
  for (const method of ["post", "put", "patch", "delete"] as const)
    expect((await request(enabled())[method]("/api/v1/role-rubrics").set("Authorization", "Bearer valid")).status).toBe(404);
  expect(rpc).not.toHaveBeenCalled();
});

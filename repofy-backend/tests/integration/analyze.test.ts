import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { getApp } from "../helpers/supertest-app";
import { createAIAnalysisResponse } from "../fixtures/ai";
import {
  setupGitHubMocks,
  setupAuthMock,
  setupOpenAIMock,
  createShortTimeoutApp,
} from "../helpers/integration-setup";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

vi.mock("openai", () => {
  const mockCreate = vi.fn();
  return {
    default: class { chat = { completions: { create: mockCreate } }; },
    __mockCreate: mockCreate,
  };
});

vi.mock("../../src/config/supabase", () => ({
  getSupabaseAdmin: vi.fn(),
}));

describe("POST /api/analyze/:username", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("returns 200 with report data when authenticated", async () => {
    setupGitHubMocks(fetchMock);
    await setupAuthMock(true);
    await setupOpenAIMock(() => createAIAnalysisResponse());

    const app = getApp();
    const res = await request(app)
      .post("/api/analyze/octocat")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.analyzedName).toBe("The Octocat");
    expect(res.body.data.report).toBeDefined();
    expect(res.body.data.report.candidateLevel).toBe("Mid-Level");
  });

  it("returns 401 without auth", async () => {
    const app = getApp();
    const res = await request(app).post("/api/analyze/octocat");

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("returns 400 for invalid username", async () => {
    await setupAuthMock(true);

    const app = getApp();
    const res = await request(app)
      .post("/api/analyze/-invalid")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("returns error when GitHub fetch fails", async () => {
    await setupAuthMock(true);
    await setupOpenAIMock(() => createAIAnalysisResponse());
    fetchMock.mockReturnValue(
      Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) }),
    );

    const app = getApp();
    const res = await request(app)
      .post("/api/analyze/nonexistent")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it("returns 500 when OpenAI fails", async () => {
    setupGitHubMocks(fetchMock);
    await setupAuthMock(true);
    const mod = await import("openai");
    const mockCreate = (mod as any).__mockCreate as ReturnType<typeof vi.fn>;
    mockCreate.mockRejectedValue(new Error("OpenAI rate limit exceeded"));

    const app = getApp();
    const res = await request(app)
      .post("/api/analyze/octocat")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });

  it("returns 504 without double-response when request is aborted", async () => {
    await setupAuthMock(true);
    // Make fetch hang until the abort signal fires, then reject
    fetchMock.mockImplementation((_url: string, opts?: { signal?: AbortSignal }) => {
      return new Promise((_resolve, reject) => {
        const onAbort = () => reject(new DOMException("The operation was aborted", "AbortError"));
        if (opts?.signal?.aborted) return onAbort();
        opts?.signal?.addEventListener("abort", onAbort);
      });
    });

    const { analyzeUser } = await import("../../src/controllers/analyze.controller");
    const shortTimeoutApp = await createShortTimeoutApp("post", "/api/analyze/:username", analyzeUser);

    const res = await request(shortTimeoutApp)
      .post("/api/analyze/octocat")
      .set("Authorization", "Bearer valid-token");

    // The timeout middleware sends 504, and the controller's abort guard
    // prevents a second response (no "headers already sent" crash)
    expect(res.status).toBe(504);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain("timed out");
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { getApp } from "../helpers/supertest-app";
import { createAIAdviceResponse } from "../fixtures/ai";
import {
  setupGitHubMocks,
  setupAuthMock,
  setupOpenAIMock,
  createShortTimeoutApp,
} from "../helpers/integration-setup";
import { getMockCreate } from "../helpers/mock-openai";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

vi.mock("openai");

vi.mock("../../src/config/supabase", () => ({
  getSupabaseAdmin: vi.fn(),
}));

describe("POST /api/advice/:username", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("returns 200 with advice data when authenticated", async () => {
    setupGitHubMocks(fetchMock);
    await setupAuthMock(true);
    await setupOpenAIMock(() => createAIAdviceResponse());

    const app = getApp();
    const res = await request(app)
      .post("/api/advice/octocat")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.analyzedName).toBe("The Octocat");
    expect(res.body.data.advice).toBeDefined();
    expect(res.body.data.advice.summary).toBe("Focus on testing and documentation.");
  });

  it("returns 401 without auth", async () => {
    const app = getApp();
    const res = await request(app).post("/api/advice/octocat");

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("returns 400 for invalid username", async () => {
    await setupAuthMock(true);

    const app = getApp();
    const res = await request(app)
      .post("/api/advice/-invalid")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("returns error when GitHub fetch fails", async () => {
    await setupAuthMock(true);
    await setupOpenAIMock(() => createAIAdviceResponse());
    fetchMock.mockReturnValue(
      Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) }),
    );

    const app = getApp();
    const res = await request(app)
      .post("/api/advice/nonexistent")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it("returns 500 when OpenAI fails", async () => {
    setupGitHubMocks(fetchMock);
    await setupAuthMock(true);
    const mockCreate = await getMockCreate();
    mockCreate.mockRejectedValue(new Error("OpenAI rate limit exceeded"));

    const app = getApp();
    const res = await request(app)
      .post("/api/advice/octocat")
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

    const { adviseUser } = await import("../../src/controllers/advice.controller");
    const shortTimeoutApp = await createShortTimeoutApp("post", "/api/advice/:username", adviseUser);

    const res = await request(shortTimeoutApp)
      .post("/api/advice/octocat")
      .set("Authorization", "Bearer valid-token");

    // The timeout middleware sends 504, and the controller's abort guard
    // prevents a second response (no "headers already sent" crash)
    expect(res.status).toBe(504);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain("timed out");
  });
});

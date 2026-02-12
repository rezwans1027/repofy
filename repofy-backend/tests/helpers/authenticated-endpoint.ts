import { it, expect, vi } from "vitest";
import request from "supertest";
import { getApp } from "./supertest-app";
import { setupGitHubMocks, setupAuthMock, createShortTimeoutApp } from "./integration-setup";
import { getMockCreate } from "./mock-openai";
import type { RequestHandler } from "express";

export interface AuthEndpointConfig {
  /** Base URL path without username, e.g. "/api/analyze" */
  basePath: string;
  /** Express route pattern, e.g. "/api/analyze/:username" */
  routePattern: string;
  /** The global fetch mock */
  fetchMock: ReturnType<typeof vi.fn>;
  /** Dynamically import the controller handler */
  importHandler: () => Promise<RequestHandler>;
}

/**
 * Generates the 5 common auth-gated endpoint tests shared by
 * /api/analyze/:username and /api/advice/:username.
 *
 * Call inside the parent `describe()` block — the `it()` calls are
 * registered directly, not wrapped in another describe.
 */
export function sharedAuthEndpointTests(config: AuthEndpointConfig) {
  const { basePath, routePattern, fetchMock, importHandler } = config;

  it("returns 401 without auth", async () => {
    const app = getApp();
    const res = await request(app).post(`${basePath}/octocat`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("returns 400 for invalid username", async () => {
    await setupAuthMock(true);

    const app = getApp();
    const res = await request(app)
      .post(`${basePath}/-invalid`)
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("returns error when GitHub fetch fails", async () => {
    await setupAuthMock(true);
    fetchMock.mockReturnValue(
      Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) }),
    );

    const app = getApp();
    const res = await request(app)
      .post(`${basePath}/nonexistent`)
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
      .post(`${basePath}/octocat`)
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });

  it("returns 504 without double-response when request is aborted", async () => {
    await setupAuthMock(true);
    fetchMock.mockImplementation((_url: string, opts?: { signal?: AbortSignal }) => {
      return new Promise((_resolve, reject) => {
        const onAbort = () => reject(new DOMException("The operation was aborted", "AbortError"));
        if (opts?.signal?.aborted) return onAbort();
        opts?.signal?.addEventListener("abort", onAbort);
      });
    });

    const handler = await importHandler();
    const shortTimeoutApp = await createShortTimeoutApp("post", routePattern, handler);

    const res = await request(shortTimeoutApp)
      .post(`${basePath}/octocat`)
      .set("Authorization", "Bearer valid-token");

    // The timeout middleware sends 504, and the controller's abort guard
    // prevents a second response (no "headers already sent" crash)
    expect(res.status).toBe(504);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain("timed out");
  });
}

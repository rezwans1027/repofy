import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

vi.mock("../../../src/config/env", () => ({
  env: {
    corsOrigin: "https://repofy.app, https://www.repofy.app",
    isProduction: false,
  },
}));

import { csrfProtection } from "../../../src/middleware/csrf";

function createMocks(overrides: {
  method?: string;
  path?: string;
  originalUrl?: string;
  cookies?: Record<string, string>;
  headers?: Record<string, string>;
} = {}) {
  const req = {
    method: overrides.method ?? "POST",
    path: overrides.path ?? "/api/test",
    originalUrl: overrides.originalUrl ?? overrides.path ?? "/api/test",
    cookies: overrides.cookies ?? {},
    headers: overrides.headers ?? {},
  } as unknown as Request;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  const next = vi.fn() as NextFunction;
  return { req, res, next };
}

describe("csrfProtection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Safe methods bypass ---
  it("allows GET requests through without checks", () => {
    const { req, res, next } = createMocks({ method: "GET" });
    csrfProtection(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("allows HEAD requests through without checks", () => {
    const { req, res, next } = createMocks({ method: "HEAD" });
    csrfProtection(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("allows OPTIONS requests through without checks", () => {
    const { req, res, next } = createMocks({ method: "OPTIONS" });
    csrfProtection(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  // --- Skip paths ---
  it("skips CSRF check for /api/stripe/webhook by path", () => {
    const { req, res, next } = createMocks({
      method: "POST",
      path: "/api/stripe/webhook",
      cookies: { access_token: "tok" },
    });
    csrfProtection(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("skips CSRF check for /api/stripe/webhook by originalUrl", () => {
    const { req, res, next } = createMocks({
      method: "POST",
      path: "/different",
      originalUrl: "/api/stripe/webhook",
      cookies: { access_token: "tok" },
    });
    csrfProtection(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  // --- No auth cookies => bypass ---
  it("allows mutating request when no auth cookies are present", () => {
    const { req, res, next } = createMocks({
      method: "POST",
      cookies: {},
    });
    csrfProtection(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  // --- X-Requested-With header check ---
  it("returns 403 when access_token cookie present but X-Requested-With missing", () => {
    const { req, res, next } = createMocks({
      method: "POST",
      cookies: { access_token: "tok" },
      headers: {},
    });
    csrfProtection(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 403 when refresh_token cookie present but X-Requested-With missing", () => {
    const { req, res, next } = createMocks({
      method: "POST",
      cookies: { refresh_token: "tok" },
      headers: {},
    });
    csrfProtection(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  // --- Origin header validation ---
  it("returns 403 when origin is not in the allowlist", () => {
    const { req, res, next } = createMocks({
      method: "POST",
      cookies: { access_token: "tok" },
      headers: {
        "x-requested-with": "XMLHttpRequest",
        origin: "https://evil.com",
      },
    });
    csrfProtection(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("allows request when origin matches an allowed origin", () => {
    const { req, res, next } = createMocks({
      method: "POST",
      cookies: { access_token: "tok" },
      headers: {
        "x-requested-with": "XMLHttpRequest",
        origin: "https://repofy.app",
      },
    });
    csrfProtection(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("allows request when origin matches second allowed origin", () => {
    const { req, res, next } = createMocks({
      method: "POST",
      cookies: { access_token: "tok" },
      headers: {
        "x-requested-with": "XMLHttpRequest",
        origin: "https://www.repofy.app",
      },
    });
    csrfProtection(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  // --- Sec-Fetch-Site check ---
  it("returns 403 when sec-fetch-site is cross-site", () => {
    const { req, res, next } = createMocks({
      method: "POST",
      cookies: { access_token: "tok" },
      headers: {
        "x-requested-with": "XMLHttpRequest",
        "sec-fetch-site": "cross-site",
      },
    });
    csrfProtection(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("allows request when sec-fetch-site is same-origin", () => {
    const { req, res, next } = createMocks({
      method: "POST",
      cookies: { access_token: "tok" },
      headers: {
        "x-requested-with": "XMLHttpRequest",
        "sec-fetch-site": "same-origin",
      },
    });
    csrfProtection(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("allows request when sec-fetch-site is absent", () => {
    const { req, res, next } = createMocks({
      method: "POST",
      cookies: { access_token: "tok" },
      headers: {
        "x-requested-with": "XMLHttpRequest",
      },
    });
    csrfProtection(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  // --- All mutating methods ---
  it.each(["POST", "PUT", "DELETE", "PATCH"])("enforces CSRF for %s method", (method) => {
    const { req, res, next } = createMocks({
      method,
      cookies: { access_token: "tok" },
      headers: {},
    });
    csrfProtection(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  // --- Full happy path ---
  it("allows a valid mutating request through all checks", () => {
    const { req, res, next } = createMocks({
      method: "DELETE",
      cookies: { access_token: "tok", refresh_token: "rtok" },
      headers: {
        "x-requested-with": "XMLHttpRequest",
        origin: "https://repofy.app",
        "sec-fetch-site": "same-origin",
      },
    });
    csrfProtection(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  // --- Origin absent is allowed (e.g. same-origin requests may omit it) ---
  it("allows request when origin header is absent", () => {
    const { req, res, next } = createMocks({
      method: "POST",
      cookies: { access_token: "tok" },
      headers: {
        "x-requested-with": "XMLHttpRequest",
      },
    });
    csrfProtection(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

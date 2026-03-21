import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

vi.mock("../../../src/config/env", () => ({
  env: {
    isProduction: false,
  },
}));

import {
  setAuthCookies,
  clearAuthCookies,
  extractAccessToken,
  extractRefreshToken,
} from "../../../src/lib/cookie-utils";

function createRes() {
  return {
    cookie: vi.fn(),
    clearCookie: vi.fn(),
  } as unknown as Response;
}

function createReq(overrides: {
  cookies?: Record<string, string>;
  headers?: Record<string, string>;
} = {}) {
  return {
    cookies: overrides.cookies ?? {},
    headers: overrides.headers ?? {},
  } as unknown as Request;
}

describe("setAuthCookies", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sets both access_token and refresh_token cookies", () => {
    const res = createRes();
    setAuthCookies(res, "access-tok", "refresh-tok");

    expect(res.cookie).toHaveBeenCalledTimes(2);
    expect(res.cookie).toHaveBeenCalledWith(
      "access_token",
      "access-tok",
      expect.objectContaining({
        httpOnly: true,
        sameSite: "strict",
        path: "/",
        maxAge: 2 * 60 * 60 * 1000,
      }),
    );
    expect(res.cookie).toHaveBeenCalledWith(
      "refresh_token",
      "refresh-tok",
      expect.objectContaining({
        httpOnly: true,
        sameSite: "strict",
        path: "/",
        maxAge: 30 * 24 * 60 * 60 * 1000,
      }),
    );
  });

  it("sets secure flag based on production environment", () => {
    const res = createRes();
    setAuthCookies(res, "a", "r");

    // env.isProduction is false in test mock
    expect(res.cookie).toHaveBeenCalledWith(
      "access_token",
      "a",
      expect.objectContaining({ secure: false }),
    );
    expect(res.cookie).toHaveBeenCalledWith(
      "refresh_token",
      "r",
      expect.objectContaining({ secure: false }),
    );
  });
});

describe("clearAuthCookies", () => {
  beforeEach(() => vi.clearAllMocks());

  it("clears both auth cookies with correct path", () => {
    const res = createRes();
    clearAuthCookies(res);

    expect(res.clearCookie).toHaveBeenCalledTimes(2);
    expect(res.clearCookie).toHaveBeenCalledWith(
      "access_token",
      expect.objectContaining({ path: "/" }),
    );
    expect(res.clearCookie).toHaveBeenCalledWith(
      "refresh_token",
      expect.objectContaining({ path: "/" }),
    );
  });
});

describe("extractAccessToken", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns token from access_token cookie when present", () => {
    const req = createReq({ cookies: { access_token: "cookie-token" } });
    expect(extractAccessToken(req)).toBe("cookie-token");
  });

  it("falls back to Authorization Bearer header when no cookie", () => {
    const req = createReq({
      cookies: {},
      headers: { authorization: "Bearer header-token" },
    });
    expect(extractAccessToken(req)).toBe("header-token");
  });

  it("prefers cookie over Authorization header", () => {
    const req = createReq({
      cookies: { access_token: "cookie-token" },
      headers: { authorization: "Bearer header-token" },
    });
    expect(extractAccessToken(req)).toBe("cookie-token");
  });

  it("returns undefined when no cookie and no Authorization header", () => {
    const req = createReq({});
    expect(extractAccessToken(req)).toBeUndefined();
  });

  it("returns undefined when Authorization header is not Bearer", () => {
    const req = createReq({
      headers: { authorization: "Basic abc123" },
    });
    expect(extractAccessToken(req)).toBeUndefined();
  });

  it("returns undefined when cookies object is undefined", () => {
    const req = { headers: {} } as unknown as Request;
    expect(extractAccessToken(req)).toBeUndefined();
  });
});

describe("extractRefreshToken", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns token from refresh_token cookie", () => {
    const req = createReq({ cookies: { refresh_token: "rt-value" } });
    expect(extractRefreshToken(req)).toBe("rt-value");
  });

  it("returns undefined when no refresh_token cookie", () => {
    const req = createReq({});
    expect(extractRefreshToken(req)).toBeUndefined();
  });

  it("returns undefined when cookies is undefined", () => {
    const req = { headers: {} } as unknown as Request;
    expect(extractRefreshToken(req)).toBeUndefined();
  });

  it("does not fall back to any header", () => {
    const req = createReq({
      cookies: {},
      headers: { authorization: "Bearer something" },
    });
    expect(extractRefreshToken(req)).toBeUndefined();
  });
});

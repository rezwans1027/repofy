import { describe, it, expect } from "vitest";
import router from "../../../src/routes/auth.routes";

describe("auth routes wiring", () => {
  const stack = (router as any).stack as any[];

  it("has a POST /auth/github-callback route", () => {
    const layer = stack.find(
      (l: any) => l.route?.path === "/auth/github-callback" && l.route?.methods?.post,
    );
    expect(layer).toBeDefined();
  });

  it("has a POST /auth/refresh route", () => {
    const layer = stack.find(
      (l: any) => l.route?.path === "/auth/refresh" && l.route?.methods?.post,
    );
    expect(layer).toBeDefined();
  });

  it("has a GET /auth/me route", () => {
    const layer = stack.find(
      (l: any) => l.route?.path === "/auth/me" && l.route?.methods?.get,
    );
    expect(layer).toBeDefined();
  });

  it("has a POST /auth/logout route", () => {
    const layer = stack.find(
      (l: any) => l.route?.path === "/auth/logout" && l.route?.methods?.post,
    );
    expect(layer).toBeDefined();
  });

  it("has a GET /auth/export-data route", () => {
    const layer = stack.find(
      (l: any) => l.route?.path === "/auth/export-data" && l.route?.methods?.get,
    );
    expect(layer).toBeDefined();
  });

  it("has a DELETE /auth/account route", () => {
    const layer = stack.find(
      (l: any) => l.route?.path === "/auth/account" && l.route?.methods?.delete,
    );
    expect(layer).toBeDefined();
  });

  it("does NOT have old signup/login routes", () => {
    const oldPaths = ["/auth/signup/initiate", "/auth/signup/verify", "/auth/signup/resend", "/auth/login"];
    for (const path of oldPaths) {
      const layer = stack.find((l: any) => l.route?.path === path);
      expect(layer).toBeUndefined();
    }
  });
});

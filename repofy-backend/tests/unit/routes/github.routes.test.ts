import { describe, it, expect } from "vitest";
import router from "../../../src/routes/github.routes";

describe("github routes wiring", () => {
  const stack = (router as any).stack as any[];

  it("has a GET /github/search route", () => {
    const layer = stack.find(
      (l: any) => l.route?.path === "/github/search" && l.route?.methods?.get,
    );
    expect(layer).toBeDefined();
  });

  it("GET /github/search has correct middleware chain in order", () => {
    const layer = stack.find((l: any) => l.route?.path === "/github/search");
    const names = layer.route.stack.map((s: any) => s.handle.name);
    expect(names).toEqual(["", "requireAuth", "timeoutMiddleware", "asyncHandlerWrapper"]);
  });

  it("has a GET /github/:username route", () => {
    const layer = stack.find(
      (l: any) => l.route?.path === "/github/:username" && l.route?.methods?.get,
    );
    expect(layer).toBeDefined();
  });

  it("GET /github/:username has correct middleware chain in order", () => {
    const layer = stack.find((l: any) => l.route?.path === "/github/:username");
    const names = layer.route.stack.map((s: any) => s.handle.name);
    expect(names).toEqual(["", "requireAuth", "timeoutMiddleware", "asyncHandlerWrapper"]);
  });
});

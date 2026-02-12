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

  it("GET /github/search has 3 middleware in chain (rateLimit, timeout, asyncHandler)", () => {
    const layer = stack.find((l: any) => l.route?.path === "/github/search");
    expect(layer.route.stack).toHaveLength(3);
  });

  it("has a GET /github/:username route", () => {
    const layer = stack.find(
      (l: any) => l.route?.path === "/github/:username" && l.route?.methods?.get,
    );
    expect(layer).toBeDefined();
  });

  it("GET /github/:username has 3 middleware in chain", () => {
    const layer = stack.find((l: any) => l.route?.path === "/github/:username");
    expect(layer.route.stack).toHaveLength(3);
  });
});

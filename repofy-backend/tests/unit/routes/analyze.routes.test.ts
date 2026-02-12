import { describe, it, expect } from "vitest";
import router from "../../../src/routes/analyze.routes";

describe("analyze routes wiring", () => {
  const stack = (router as any).stack as any[];

  it("has a POST /analyze/:username route", () => {
    const layer = stack.find(
      (l: any) => l.route?.path === "/analyze/:username" && l.route?.methods?.post,
    );
    expect(layer).toBeDefined();
  });

  it("POST /analyze/:username has 4 middleware in chain (rateLimit, timeout, auth, asyncHandler)", () => {
    const layer = stack.find((l: any) => l.route?.path === "/analyze/:username");
    expect(layer.route.stack).toHaveLength(4);
  });
});

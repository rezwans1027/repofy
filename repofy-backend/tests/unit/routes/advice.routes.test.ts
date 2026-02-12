import { describe, it, expect } from "vitest";
import router from "../../../src/routes/advice.routes";

describe("advice routes wiring", () => {
  const stack = (router as any).stack as any[];

  it("has a POST /advice/:username route", () => {
    const layer = stack.find(
      (l: any) => l.route?.path === "/advice/:username" && l.route?.methods?.post,
    );
    expect(layer).toBeDefined();
  });

  it("POST /advice/:username has 4 middleware in chain (rateLimit, timeout, auth, asyncHandler)", () => {
    const layer = stack.find((l: any) => l.route?.path === "/advice/:username");
    expect(layer.route.stack).toHaveLength(4);
  });
});

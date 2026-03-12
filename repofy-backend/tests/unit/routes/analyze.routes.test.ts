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

  it("POST /analyze/:username has correct middleware chain in order", () => {
    const layer = stack.find((l: any) => l.route?.path === "/analyze/:username");
    const names = layer.route.stack.map((s: any) => s.handle.name);
    expect(names).toEqual(["requireAuth", "", "timeoutMiddleware", "asyncHandlerWrapper"]);
  });
});

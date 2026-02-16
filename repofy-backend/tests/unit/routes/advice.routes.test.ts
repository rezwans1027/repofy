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

  it("POST /advice/:username has correct middleware chain in order", () => {
    const layer = stack.find((l: any) => l.route?.path === "/advice/:username");
    const names = layer.route.stack.map((s: any) => s.handle.name);
    expect(names).toEqual(["", "timeoutMiddleware", "requireAuth", "asyncHandlerWrapper"]);
  });
});

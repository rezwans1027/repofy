import { describe, it, expect } from "vitest";
import router from "../../../src/routes/health.routes";

describe("health routes wiring", () => {
  const stack = (router as any).stack as any[];

  it("has a GET /health route", () => {
    const layer = stack.find(
      (l: any) => l.route?.path === "/health" && l.route?.methods?.get,
    );
    expect(layer).toBeDefined();
  });

  it("has 1 handler in the chain (no extra middleware)", () => {
    const layer = stack.find((l: any) => l.route?.path === "/health");
    expect(layer.route.stack).toHaveLength(1);
  });
});

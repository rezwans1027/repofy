import { describe, it, expect } from "vitest";
import router from "../../../src/routes/credit.routes";

describe("credit routes wiring", () => {
  const stack = (router as any).stack as any[];

  it("has a GET /credits/balance route", () => {
    const layer = stack.find(
      (l: any) => l.route?.path === "/credits/balance" && l.route?.methods?.get,
    );
    expect(layer).toBeDefined();
  });

  it("GET /credits/balance has correct middleware chain in order", () => {
    const layer = stack.find(
      (l: any) => l.route?.path === "/credits/balance",
    );
    const names = layer.route.stack.map((s: any) => s.handle.name);
    expect(names).toEqual(["", "requireAuth", "timeoutMiddleware", "asyncHandlerWrapper"]);
  });
});

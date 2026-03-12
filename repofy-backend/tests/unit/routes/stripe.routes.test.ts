import { describe, it, expect } from "vitest";
import router from "../../../src/routes/stripe.routes";

describe("stripe routes wiring", () => {
  const stack = (router as any).stack as any[];

  it("has a POST /stripe/create-checkout-session route", () => {
    const layer = stack.find(
      (l: any) => l.route?.path === "/stripe/create-checkout-session" && l.route?.methods?.post,
    );
    expect(layer).toBeDefined();
  });

  it("POST /stripe/create-checkout-session has correct middleware chain in order", () => {
    const layer = stack.find(
      (l: any) => l.route?.path === "/stripe/create-checkout-session",
    );
    const names = layer.route.stack.map((s: any) => s.handle.name);
    expect(names).toEqual(["requireAuth", "", "timeoutMiddleware", "asyncHandlerWrapper"]);
  });
});

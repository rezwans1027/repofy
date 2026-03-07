import { describe, it, expect } from "vitest";
import router from "../../../src/routes/auth.routes";

describe("auth routes wiring", () => {
  const stack = (router as any).stack as any[];

  it("has a POST /auth/signup/initiate route", () => {
    const layer = stack.find(
      (l: any) => l.route?.path === "/auth/signup/initiate" && l.route?.methods?.post,
    );
    expect(layer).toBeDefined();
  });

  it("POST /auth/signup/initiate has correct middleware chain", () => {
    const layer = stack.find(
      (l: any) => l.route?.path === "/auth/signup/initiate",
    );
    const names = layer.route.stack.map((s: any) => s.handle.name);
    expect(names).toEqual(["", "asyncHandlerWrapper"]);
  });

  it("has a POST /auth/signup/verify route", () => {
    const layer = stack.find(
      (l: any) => l.route?.path === "/auth/signup/verify" && l.route?.methods?.post,
    );
    expect(layer).toBeDefined();
  });

  it("POST /auth/signup/verify has correct middleware chain", () => {
    const layer = stack.find(
      (l: any) => l.route?.path === "/auth/signup/verify",
    );
    const names = layer.route.stack.map((s: any) => s.handle.name);
    expect(names).toEqual(["", "asyncHandlerWrapper"]);
  });

  it("has a POST /auth/signup/resend route", () => {
    const layer = stack.find(
      (l: any) => l.route?.path === "/auth/signup/resend" && l.route?.methods?.post,
    );
    expect(layer).toBeDefined();
  });

  it("POST /auth/signup/resend has correct middleware chain", () => {
    const layer = stack.find(
      (l: any) => l.route?.path === "/auth/signup/resend",
    );
    const names = layer.route.stack.map((s: any) => s.handle.name);
    expect(names).toEqual(["", "asyncHandlerWrapper"]);
  });
});

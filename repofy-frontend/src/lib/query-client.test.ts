import { describe, it, expect, beforeEach, vi } from "vitest";
import { getQueryClient, resetQueryClient, STALE_SHORT, STALE_MEDIUM, STALE_LONG } from "./query-client";

describe("getQueryClient", () => {
  beforeEach(() => {
    // Reset the module-level singleton between tests
    resetQueryClient();
  });

  it("returns a QueryClient instance", () => {
    const client = getQueryClient();
    expect(client).toBeDefined();
    expect(typeof client.getQueryData).toBe("function");
  });

  it("returns the same instance on subsequent calls (browser singleton)", () => {
    const client1 = getQueryClient();
    const client2 = getQueryClient();
    expect(client1).toBe(client2);
  });

  it("creates a new client when window is undefined (SSR)", () => {
    const originalWindow = globalThis.window;
    // @ts-expect-error -- simulating SSR
    delete globalThis.window;

    const client1 = getQueryClient();
    const client2 = getQueryClient();
    expect(client1).not.toBe(client2);

    globalThis.window = originalWindow;
  });
});

describe("resetQueryClient", () => {
  it("causes getQueryClient to return a fresh instance after reset", () => {
    const client1 = getQueryClient();
    // Set some data so we can verify it's cleared
    client1.setQueryData(["test"], "value");
    expect(client1.getQueryData(["test"])).toBe("value");

    resetQueryClient();

    // After reset, the old client's data should be cleared
    expect(client1.getQueryData(["test"])).toBeUndefined();
  });
});

describe("stale-time constants", () => {
  it("exports expected values", () => {
    expect(STALE_SHORT).toBe(30_000);
    expect(STALE_MEDIUM).toBe(120_000);
    expect(STALE_LONG).toBe(300_000);
  });
});

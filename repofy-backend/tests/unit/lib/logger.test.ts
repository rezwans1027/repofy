import { describe, it, expect, vi, beforeEach } from "vitest";

describe("logger", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("info() logs with ISO timestamp, [Repofy] prefix, and INFO level", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { logger } = await import("../../../src/lib/logger");

    logger.info("hello");

    expect(spy).toHaveBeenCalledOnce();
    const msg = spy.mock.calls[0][0] as string;
    expect(msg).toMatch(/^\d{4}-\d{2}-\d{2}T.+Z \[Repofy\] INFO: hello$/);
  });

  it("warn() logs with WARN level", async () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { logger } = await import("../../../src/lib/logger");

    logger.warn("caution");

    expect(spy).toHaveBeenCalledOnce();
    const msg = spy.mock.calls[0][0] as string;
    expect(msg).toMatch(/\[Repofy\] WARN: caution$/);
  });

  it("error() logs with ERROR level and passes extra args through", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { logger } = await import("../../../src/lib/logger");
    const extra = { detail: 42 };

    logger.error("fail", extra);

    expect(spy).toHaveBeenCalledOnce();
    const msg = spy.mock.calls[0][0] as string;
    expect(msg).toMatch(/\[Repofy\] ERROR: fail$/);
    expect(spy.mock.calls[0][1]).toBe(extra);
  });
});

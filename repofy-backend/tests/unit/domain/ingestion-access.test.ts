import { afterEach, expect, it, vi } from "vitest";
import { extractionFixture } from "../../helpers/extraction-fixtures";
import { ACCESS_POLL_MS } from "../../../src/domain/ingestion/policy";

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

function barrier() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}

it("extracts 1,000 files without charging database latency for every source read", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const fixture = await extractionFixture(Object.fromEntries(Array.from({ length: 1000 }, (_, index) => [`src/file-${index}.json`, "{}"])));
  try {
    let now = 0;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const original = fixture.store.checkpoint.bind(fixture.store);
    const checkpoint = vi.spyOn(fixture.store, "checkpoint").mockImplementation(async (...args) => {
      // Deterministic 65 ms remote round-trip cost: the previous implementation
      // spent over 60 seconds here and expired before reading all 1,000 files.
      now += 65;
      await original(...args);
    });
    const extracted = await fixture.extract();
    expect(extracted.bundle.files).toHaveLength(1000);
    expect(extracted.metrics.files).toBe(1000);
    expect(extracted.metrics.durationMs).toBe(130);
    expect(checkpoint).toHaveBeenCalledTimes(2); // Fresh inventory and publication fences.
  } finally { await fixture.cleanup(); }
}, 10000);

it("forces fresh inventory authorization even inside the read cache window", async () => {
  const fixture = await extractionFixture({ "source.ts": "export const value = 1;" });
  try {
    const files = await fixture.context.files();
    const checkpoint = vi.spyOn(fixture.store, "checkpoint");
    expect(await fixture.context.readText(files[0].locatorId)).toContain("value = 1");
    expect(checkpoint).not.toHaveBeenCalled();
    fixture.store.revoked = true;
    await expect(fixture.context.files()).rejects.toThrow("ACCESS_REVOKED");
    expect(checkpoint).toHaveBeenCalledTimes(1);
    await expect(fixture.context.readText(files[0].locatorId)).rejects.toThrow("CONTEXT_DISPOSED");
  } finally { await fixture.cleanup(); }
});

it("coalesces stale concurrent reads and inventory checks, denying all after revocation", async () => {
  const fixture = await extractionFixture({ "source.ts": "export const value = 1;" });
  const pending = barrier();
  try {
    let now = 0;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const files = await fixture.context.files();
    const original = fixture.store.checkpoint.bind(fixture.store);
    const checkpoint = vi.spyOn(fixture.store, "checkpoint").mockImplementation(async (...args) => {
      await pending.promise;
      await original(...args);
    });
    now = ACCESS_POLL_MS;
    const results = Promise.allSettled([
      ...Array.from({ length: 20 }, () => fixture.context.readText(files[0].locatorId)), fixture.context.files(),
    ]);
    expect(checkpoint).toHaveBeenCalledTimes(1);
    fixture.store.revoked = true;
    pending.release();
    for (const result of await results) {
      expect(result.status).toBe("rejected");
      if (result.status === "rejected") expect(result.reason).toMatchObject({ code: "ACCESS_REVOKED" });
    }
    expect(checkpoint).toHaveBeenCalledTimes(1);
  } finally { pending.release(); await fixture.cleanup(); }
});

it("keeps idle revocation polling active and shares its pending check with readers", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const fixture = await extractionFixture({ "source.ts": "export const value = 1;" });
  const pending = barrier();
  try {
    const files = await fixture.context.files();
    const original = fixture.store.checkpoint.bind(fixture.store);
    const checkpoint = vi.spyOn(fixture.store, "checkpoint").mockImplementation(async (...args) => {
      await pending.promise;
      await original(...args);
    });
    await vi.advanceTimersByTimeAsync(ACCESS_POLL_MS);
    expect(checkpoint).toHaveBeenCalledTimes(1);
    const result = expect(fixture.context.readText(files[0].locatorId)).rejects.toThrow("ACCESS_REVOKED");
    fixture.store.revoked = true;
    pending.release();
    await result;
    expect(checkpoint).toHaveBeenCalledTimes(1);
    await expect(fixture.context.files()).rejects.toThrow("CONTEXT_DISPOSED");
    expect([...fixture.store.attempts.values()].every(attempt => attempt.disposed)).toBe(true);
  } finally { pending.release(); await fixture.cleanup(); }
});

it.each(["dispose", "abort"] as const)("does not expose files or source when %s races a successful remote check", async action => {
  const fixture = await extractionFixture({ "source.ts": "export const value = 1;" });
  const pending = barrier();
  await fixture.context.dispose();
  const cancellation = new AbortController();
  const context = await fixture.service.prepareSafeSnapshot(fixture.store.request, cancellation.signal);
  try {
    let now = 0;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const files = await context.files();
    // The database check has succeeded, but its response has not arrived yet.
    const checkpoint = vi.spyOn(fixture.store, "checkpoint").mockImplementation(() => pending.promise);
    now = ACCESS_POLL_MS;
    const results = Promise.allSettled([context.readText(files[0].locatorId), context.files()]);
    expect(checkpoint).toHaveBeenCalledTimes(1);
    if (action === "dispose") await context.dispose(); else cancellation.abort();
    pending.release();
    expect((await results).every(result => result.status === "rejected")).toBe(true);
    await expect(context.readText(files[0].locatorId)).rejects.toThrow("CONTEXT_DISPOSED");
  } finally { pending.release(); await context.dispose(); await fixture.cleanup(); }
});

it("does not extend authorization freshness by the duration of a slow database response", async () => {
  const fixture = await extractionFixture({ "source.ts": "export const value = 1;" });
  try {
    let now = 0;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const original = fixture.store.checkpoint.bind(fixture.store);
    const checkpoint = vi.spyOn(fixture.store, "checkpoint").mockImplementation(async (...args) => {
      await original(...args);
      now += ACCESS_POLL_MS;
    });
    const files = await fixture.context.files();
    expect(checkpoint).toHaveBeenCalledTimes(1);
    fixture.store.revoked = true;
    await expect(fixture.context.readText(files[0].locatorId)).rejects.toThrow("ACCESS_REVOKED");
    expect(checkpoint).toHaveBeenCalledTimes(2);
  } finally { await fixture.cleanup(); }
});

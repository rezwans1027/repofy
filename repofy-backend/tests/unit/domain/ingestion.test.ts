import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { mkdtemp, readdir, rm, lstat, writeFile, mkdir, symlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { gzipSync } from "node:zlib";
import { SnapshotIngestionService } from "../../../src/domain/ingestion/service";
import { WorkspaceManager } from "../../../src/domain/ingestion/workspace";
import { securityPolicy, MAX_WORKSPACE_AGE_MS, policyHash } from "../../../src/domain/ingestion/policy";
import { IngestionError } from "../../../src/domain/ingestion/errors";
import { staticSecretScanner } from "../../../src/domain/ingestion/scanner";
import { fixtureCrypto } from "../../helpers/evidence-fixtures";
import { archiveFixture, rawTar, MemoryIngestionStore, SyntheticSnapshotSource, type TarFixtureEntry } from "../../helpers/ingestion-fixtures";

// The ingestion dependency graph must never execute repository commands or config.
vi.mock("node:child_process", () => Object.fromEntries(["exec", "execSync", "execFile", "execFileSync", "spawn", "spawnSync", "fork"].map(name => [name, () => { throw new Error("Repository execution forbidden"); }])));
let root: string; let store: MemoryIngestionStore; let source: SyntheticSnapshotSource; let manager: WorkspaceManager;
const service = (limits = {}, scanner = staticSecretScanner) => new SnapshotIngestionService(store, source, fixtureCrypto(), manager, securityPolicy(limits), scanner);
beforeEach(async () => { root = await mkdtemp(join(tmpdir(), "repofy-ingestion-test-")); store = new MemoryIngestionStore(); source = new SyntheticSnapshotSource(store); manager = new WorkspaceManager(root); });
afterEach(async () => { expect(await readdir(root)).toEqual([]); await rm(root, { recursive: true, force: true }); vi.restoreAllMocks(); });

it("pins before download, retries the same SHA after branch movement, and disposes read capabilities", async () => {
  const ingestion = service();
  const first = await ingestion.prepareSafeSnapshot(store.request); const files = await first.files();
  expect(await first.readText(files[0].locatorId)).toContain("answer = 42");
  expect(first.summary.semanticAnalysis).toBe("not_performed"); expect(Object.isFrozen(first)).toBe(true); expect(Object.isFrozen(files[0].locator)).toBe(true);
  expect(JSON.stringify(first)).not.toContain("export const"); expect(JSON.stringify(first)).not.toContain(root);
  expect(await readdir(root)).toEqual([]); await first.dispose(); await expect(first.files()).rejects.toThrow("CONTEXT_DISPOSED");
  source.sha = "b".repeat(40);
  await ingestion.withSafeSnapshot(store.request, async context => { expect(context.snapshot.commitSha).toBe("a".repeat(40)); });
  expect(source.resolutions).toBe(1); expect(source.downloads).toEqual(["a".repeat(40), "a".repeat(40)]);
  expect([...store.attempts.values()].every(a => a.disposed)).toBe(true);
});
it("exposes only scanned UTF-8 and safe locators, with explicit counted exclusions", async () => {
  const secret = "ghp_" + "A7".repeat(20);
  source.archive = archiveFixture([
    { path: "fixture-root/.env", body: "SENSITIVE_PATH_SENTINEL" },
    { path: "fixture-root/node_modules/x.ts", body: "VENDOR_SENTINEL" },
    { path: "fixture-root/dist/out.ts", body: "GENERATED_SENTINEL" },
    { path: "fixture-root/image.blob", body: Buffer.from([0, 1, 2]) },
    { path: "fixture-root/invalid.txt", body: Buffer.from([0xff, 0xfe, 0x40]) },
    { path: "fixture-root/weird.custom", body: secret },
    { path: `fixture-root/${secret}.ts`, body: "otherwise fine" },
    { path: "fixture-root/generated.ts", body: "// @generated\nconst x=1;" },
    { path: "fixture-root/ignored.ts", body: "IGNORE_SENTINEL" },
    { path: "fixture-root/src/café.ts", body: "export const café = 1;\r\n" },
    // Last in archive: ignore policy must still apply to earlier entries.
    { path: "fixture-root/.repofyignore", body: "ignored.ts\n!.env\n!node_modules/x.ts\n" },
  ]);
  const logs: unknown[] = []; for (const key of ["log", "error", "warn"] as const) vi.spyOn(console, key).mockImplementation((...args) => { logs.push(args); });
  await service().withSafeSnapshot(store.request, async context => {
    const files = await context.files(); expect(files).toHaveLength(1); expect(files[0].locator).toEqual({ kind: "file", path: "src/café.ts" });
    expect(await context.readText(files[0].locatorId)).toBe("export const café = 1;\n");
    expect(context.summary.excluded).toMatchObject({ sensitive_path: 1, dependency: 1, generated: 2, binary: 1, unsupported_encoding: 1, secret_or_sensitive_data: 2, user_ignored: 1, policy_file: 1 });
    expect(context.summary.scope).toBe("filtered");
    await expect(context.readText("../.env")).rejects.toThrow("INVALID_REQUEST");
  });
  expect(JSON.stringify([...logs, ...store.attempts.values()])).not.toMatch(/SENTINEL|ghp_|\.env|weird\.custom/);
});

it.each<[string, TarFixtureEntry[], string]>([
  ["traversal", [{ path: "fixture-root/../escape.ts", body: "bad" }], "UNSAFE_PATH"],
  ["absolute", [{ path: "/root/escape.ts", body: "bad" }], "UNSAFE_PATH"],
  ["backslash", [{ path: "fixture-root/..\\escape.ts", body: "bad" }], "UNSAFE_PATH"],
  ["drive", [{ path: "C:/escape.ts", body: "bad" }], "UNSAFE_PATH"],
  ["symlink", [{ path: "fixture-root/link", type: "SymbolicLink", linkpath: "/tmp/escape" }], "UNSAFE_ENTRY"],
  ["hardlink", [{ path: "fixture-root/link", type: "Link", linkpath: "fixture-root/a" }], "UNSAFE_ENTRY"],
  ["device", [{ path: "fixture-root/device", type: "CharacterDevice" }], "UNSAFE_ENTRY"],
  ["duplicate", [{ path: "fixture-root/a" }, { path: "fixture-root/a" }], "UNSAFE_PATH"],
  ["unicode collision", [{ path: "fixture-root/café" }, { path: "fixture-root/cafe\u0301" }], "UNSAFE_PATH"],
  ["parent file", [{ path: "fixture-root/a" }, { path: "fixture-root/a/b" }], "UNSAFE_PATH"],
  ["child first", [{ path: "fixture-root/a/b" }, { path: "fixture-root/a" }], "UNSAFE_PATH"],
  ["second root", [{ path: "other-root/a" }], "UNSAFE_PATH"],
  ["bidi", [{ path: "fixture-root/\u202eevil.ts" }], "UNSAFE_PATH"],
])("rejects %s archives and leaves no workspace", async (_name, entries, code) => {
  source.archive = archiveFixture(entries); await expect(service().prepareSafeSnapshot(store.request)).rejects.toThrow(code); expect(store.readyCount).toBe(0);
});
it.each(["[invalid", "../escape", "!", "*".repeat(20), "x\0", "a\n".repeat(129)])("fails closed on invalid ignore rules %j", async body => {
  source.archive = archiveFixture([{ path: "fixture-root/.repofyignore", body }]);
  await expect(service().prepareSafeSnapshot(store.request)).rejects.toThrow("INVALID_IGNORE");
});
it.each([
  ["decompressed", { decompressedBytes: 2048 }, [{ path: "fixture-root/a", body: "x".repeat(16000) }], "ARCHIVE_LIMIT"],
  ["entries", { archiveEntries: 1 }, [{ path: "fixture-root/a" }], "ARCHIVE_LIMIT"],
  ["eligible count", { eligibleFiles: 1 }, [{ path: "fixture-root/a" }, { path: "fixture-root/b" }], "CONTEXT_LIMIT"],
  ["lines", { totalLines: 2 }, [{ path: "fixture-root/a", body: "a\nb\nc" }], "CONTEXT_LIMIT"],
  ["memory", { contextBytes: 2 }, [{ path: "fixture-root/a", body: "abc" }], "CONTEXT_LIMIT"],
  ["depth", { pathDepth: 2 }, [{ path: "fixture-root/a/b" }], "UNSAFE_PATH"],
  ["path length", { pathBytes: 16 }, [{ path: "fixture-root/abcdefgh" }], "UNSAFE_PATH"],
] as const)("bounds %s without returning partial context", async (_name, limits, entries, code) => {
  source.archive = archiveFixture([...entries]); await expect(service(limits).prepareSafeSnapshot(store.request)).rejects.toThrow(code); expect(store.readyCount).toBe(0);
});
it("excludes oversized text instead of pretending it was analyzed", async () => {
  source.archive = archiveFixture([{ path: "fixture-root/a", body: "oversized" }]);
  await service({ fileBytes: 4 }).withSafeSnapshot(store.request, async context => {
    expect(await context.files()).toHaveLength(0); expect(context.summary.excluded.oversized).toBe(1); expect(context.summary.scope).toBe("filtered");
  });
});
it.each(["truncated", "nested compression", "checksum", "missing eof", "huge pax"])("rejects %s without exposing parser diagnostics", async kind => {
  if (kind === "truncated") source.archive = source.archive.subarray(0, 30);
  if (kind === "nested compression") source.archive = gzipSync(source.archive);
  if (kind === "checksum") { const tar = rawTar([{ path: "fixture-root/a" }]); tar[0] = 0; source.archive = gzipSync(tar); }
  if (kind === "missing eof") source.archive = gzipSync(rawTar([{ path: "fixture-root/a" }]).subarray(0, 1024));
  if (kind === "huge pax") source.archive = archiveFixture([{ path: "pax", type: "ExtendedHeader", body: "x".repeat(70000) }]);
  await expect(service().prepareSafeSnapshot(store.request)).rejects.toBeInstanceOf(IngestionError);
});
it("fails closed and sanitizes scanner, provider, and disk-full errors", async () => {
  const failedScanner = { ...staticSecretScanner, isSensitive: () => { throw new Error("RAW_SOURCE_SENTINEL"); } };
  await expect(service({}, failedScanner).prepareSafeSnapshot(store.request)).rejects.toThrow("SCANNER_FAILURE");
  source.download = async () => { throw Object.assign(new Error("RAW_TOKEN_SENTINEL"), { code: "ENOSPC" }); };
  await expect(service().prepareSafeSnapshot(store.request)).rejects.not.toThrow("RAW_TOKEN_SENTINEL"); expect(store.readyCount).toBe(0);
});
it("cleans up timeouts and cancellation during streaming", async () => {
  source.download = async (_r, _p, destination, signal) => {
    await writeFile(destination, "PARTIAL_RAW_SENTINEL", { mode: 0o600 });
    // Disk scheduling may outlast the test deadline under coverage instrumentation.
    signal.throwIfAborted();
    await new Promise<void>((_resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true }));
  };
  await expect(service({ prepareTimeoutMs: 50 }).prepareSafeSnapshot(store.request)).rejects.toThrow("TIMED_OUT");
  const cancellation = new AbortController(); const pending = service({ prepareTimeoutMs: 50 }).prepareSafeSnapshot(store.request, cancellation.signal);
  setTimeout(() => cancellation.abort(new Error("sensitive reason")), 30);
  await expect(pending).rejects.toThrow("CANCELED");
});
it("checks revocation during fetch, after preparation, and cancellation before provider access", async () => {
  const original = source.download.bind(source);
  source.download = async (...args) => { await original(...args); store.revoked = true; await args[4](); };
  await expect(service().prepareSafeSnapshot(store.request)).rejects.toThrow("ACCESS_REVOKED");
  store.revoked = false; source.download = original;
  const context = await service().prepareSafeSnapshot(store.request); store.revoked = true;
  await expect(context.files()).rejects.toThrow(); await context.dispose();
  const before = source.resolutions;
  await expect(service().prepareSafeSnapshot(store.request, AbortSignal.abort())).rejects.toThrow("CANCELED"); expect(source.resolutions).toBe(before);
});
it("polls revocation while the response is idle and purges the partial workspace", async () => {
  let entered!: () => void; const streaming = new Promise<void>(resolve => { entered = resolve; });
  source.download = async (_r, _p, destination, signal) => {
    await writeFile(destination, "PARTIAL_PRIVATE_SENTINEL", { mode: 0o600 }); entered();
    await new Promise<void>((_resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true }));
  };
  const pending = service().prepareSafeSnapshot(store.request);
  const rejected = expect(pending).rejects.toThrow("ACCESS_REVOKED");
  await streaming; store.revoked = true; await rejected;
  expect(store.readyCount).toBe(0);
});
it.each(["trailing members", "empty metadata flood", "PAX size override"])("rejects %s", async kind => {
  if (kind === "trailing members") source.archive = gzipSync(Buffer.concat([rawTar([{ path: "fixture-root/a" }]), rawTar([{ path: "fixture-root/hidden" }])]));
  if (kind === "empty metadata flood") source.archive = archiveFixture(Array.from({ length: 5 }, () => ({ path: "pax", type: "ExtendedHeader", body: "" })));
  if (kind === "PAX size override") source.archive = archiveFixture([{ path: "pax", type: "ExtendedHeader", body: "10 size=1\n" }, { path: "fixture-root/a", body: "a" }]);
  await expect(service(kind === "empty metadata flood" ? { archiveEntries: 2 } : {}).prepareSafeSnapshot(store.request))
    .rejects.toThrow(kind === "empty metadata flood" ? "ARCHIVE_LIMIT" : kind === "PAX size override" ? "UNSAFE_ENTRY" : "ARCHIVE_INVALID");
});

it("prevents policy-incompatible reuse and disposes when a consumer fails", async () => {
  await service().resolveSnapshot(store.request);
  expect(policyHash(securityPolicy())).not.toBe(policyHash(securityPolicy({ totalLines: 10 })));
  await expect(service({ totalLines: 10 }).prepareSafeSnapshot(store.request)).rejects.toThrow("POLICY_MISMATCH");
  await expect(service().withSafeSnapshot(store.request, async () => { throw new Error("consumer failed"); })).rejects.toThrow("consumer failed");
  expect([...store.attempts.values()].every(a => a.disposed)).toBe(true);
});
it("creates owner-only unique workspaces and sweeps expired crash/orphan data with intake/DB unavailable", async () => {
  let now = Date.now(); const janitor = new WorkspaceManager(root, () => now); const id = randomUUID();
  const created = await janitor.create(id, store.request.jobId); await writeFile(created.archive, "CRASH_SOURCE_SENTINEL", { mode: 0o600 });
  expect((await lstat(join(root, id))).mode & 0o777).toBe(0o700); expect((await lstat(join(root, id, "manifest.json"))).mode & 0o777).toBe(0o600);
  await expect(janitor.create(id, store.request.jobId)).rejects.toThrow("WORKSPACE_FAILURE");
  expect((await janitor.sweep(async () => false)).removed).toBe(0);
  now += MAX_WORKSPACE_AGE_MS + 1;
  expect(await janitor.sweep(async () => { throw new Error("database unavailable"); })).toEqual({ removed: 1, failed: 0 });
});
it("janitor fences expired leases, handles incomplete manifests, and never follows workspace links", async () => {
  const id = randomUUID(); await manager.create(id, store.request.jobId);
  expect((await manager.sweep(async () => true)).removed).toBe(1);
  const partial = randomUUID(); await mkdir(join(root, partial), { mode: 0o700 });
  const future = new WorkspaceManager(root, () => Date.now() + MAX_WORKSPACE_AGE_MS + 1000); expect((await future.sweep()).removed).toBe(1);
  const target = await mkdtemp(join(tmpdir(), "repofy-safe-target-"));
  try { await writeFile(join(target, "keep"), "safe"); await symlink(target, join(root, randomUUID())); await manager.sweep(); expect(await readdir(target)).toEqual(["keep"]); }
  finally { await rm(target, { recursive: true, force: true }); }
});
it("rejects a configured workspace whose parent symlink resolves into a public directory", async () => {
  const publicDirectory = join(root, "public"); const alias = join(root, "alias");
  await mkdir(publicDirectory, { mode: 0o700 }); await symlink(publicDirectory, alias);
  try { await expect(new WorkspaceManager(join(alias, "worker")).create(randomUUID(), store.request.jobId)).rejects.toThrow("WORKSPACE_FAILURE"); }
  finally { await rm(alias); await rm(publicDirectory, { recursive: true, force: true }); }
});

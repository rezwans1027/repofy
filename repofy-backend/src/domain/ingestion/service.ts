import { randomUUID } from "node:crypto";
import { lstat } from "node:fs/promises";
import type { LocatorCrypto } from "../evidence/locator-crypto";
import { visitArchive } from "./archive";
import { containsSqlData, decodeText, ignoreMatcher, mandatoryExclusion } from "./exclusions";
import { bounded, IngestionError, checkSignal, safeError } from "./errors";
import { ACCESS_POLL_MS, EXCLUSION_REASONS, MAX_WORKSPACE_AGE_MS, ScanSummarySchema, policyHash, securityPolicy, type ScanSummary, type SecurityPolicy } from "./policy";
import { IngestionRequestSchema, requireMatchingPolicy, type IngestionRequest, type IngestionStore, type PinnedSnapshot, type SafeFile } from "./repository";
import { staticSecretScanner, type SecretScanner } from "./scanner";
import type { SnapshotSource } from "./source";
import { WorkspaceManager } from "./workspace";

export interface SafeSnapshotContext {
  readonly snapshot: Readonly<Pick<PinnedSnapshot, "pinId" | "repositoryId" | "commitSha" | "repositoryVisibility" | "resolvedAt" | "policyHash">>;
  readonly policy: Readonly<SecurityPolicy>;
  readonly summary: Readonly<ScanSummary>;
  files(): Promise<readonly Readonly<SafeFile>[]>;
  readText(locatorId: string): Promise<string>;
  dispose(): Promise<void>;
}
/** No filesystem, credential, transport, raw archive, scanner result or unfiltered
 * path is exposed through this capability. Trusted extractors receive only this API. */
class FilteredContext implements SafeSnapshotContext {
  readonly snapshot; readonly policy; readonly summary;
  #contents; #files; #disposed = false; #guard; #cleanup;
  constructor(pin: PinnedSnapshot, summary: ScanSummary, files: SafeFile[], contents: Map<string, string>, guard: (fresh: boolean) => Promise<void>, cleanup: () => Promise<void>) {
    this.snapshot = Object.freeze({ pinId: pin.pinId, repositoryId: pin.repositoryId, commitSha: pin.commitSha,
      repositoryVisibility: pin.repositoryVisibility, resolvedAt: pin.resolvedAt, policyHash: pin.policyHash });
    this.policy = Object.freeze({ ...pin.policy, limits: Object.freeze({ ...pin.policy.limits }) }); this.summary = Object.freeze({ ...summary, excluded: Object.freeze({ ...summary.excluded }) });
    this.#files = Object.freeze(files.map(file => Object.freeze({ ...file, locator: Object.freeze({ ...file.locator }) })));
    this.#contents = contents; this.#guard = guard; this.#cleanup = cleanup; Object.freeze(this);
  }
  #assertOpen() { if (this.#disposed) throw new IngestionError("CONTEXT_DISPOSED"); }
  // Disposal can race a pending authorization check. Check immediately after
  // the final await, before returning retained file metadata or source.
  async files() { this.#assertOpen(); await this.#guard(true); this.#assertOpen(); return this.#files; }
  async readText(locatorId: string) {
    this.#assertOpen(); await this.#guard(false); this.#assertOpen(); const text = this.#contents.get(locatorId);
    if (text === undefined) throw new IngestionError("INVALID_REQUEST"); return text;
  }
  async dispose() { this.#disposed = true; this.#contents.clear(); await this.#cleanup(); }
}

export class SnapshotIngestionService {
  constructor(private readonly store: IngestionStore, private readonly source: SnapshotSource, private readonly crypto: LocatorCrypto,
    private readonly workspaces = new WorkspaceManager(), private readonly policy = securityPolicy(), private readonly scanner: SecretScanner = staticSecretScanner) {}

  /** Recheck provider access before reusing retained source evidence. The job's
   * already-pinned SHA is immutable even if the branch subsequently moves. */
  async reauthorize(request: IngestionRequest, pin: Readonly<PinnedSnapshot>) {
    try {
      const access = await this.store.access(request);
      const current = await bounded(this.source.resolve(request, access), this.policy.limits.prepareTimeoutMs);
      if (access.grantId !== pin.grantId || access.accessRevision !== pin.accessRevision || current.providerRepositoryId !== pin.providerRepositoryId
        || current.repositoryVisibility !== pin.repositoryVisibility) throw new IngestionError("ACCESS_REVOKED");
    } catch (error) { throw safeError(error); }
  }

  async resolveSnapshot(input: IngestionRequest): Promise<PinnedSnapshot> {
    try {
      const parsed = IngestionRequestSchema.safeParse(input);
      if (!parsed.success) throw new IngestionError("INVALID_REQUEST");
      const request = parsed.data;
      const existing = await this.store.readPin(request);
      if (existing) { requireMatchingPolicy(existing, this.policy); return existing; }
      const access = await this.store.access(request);
      const resolved = await bounded(this.source.resolve(request, access), this.policy.limits.prepareTimeoutMs);
      if (resolved.providerRepositoryId !== access.providerRepositoryId || resolved.repositoryVisibility !== access.repositoryVisibility) throw new IngestionError("ACCESS_REVOKED");
      // This committed write MUST finish before any download. Concurrent resolvers return the first durable pin.
      const pin = await this.store.pin(request, { jobId: request.jobId, repositoryId: request.repositoryId, ...access, ...resolved, pinId: randomUUID(),
        resolvedAt: new Date().toISOString(), policy: this.policy, policyHash: policyHash(this.policy) });
      requireMatchingPolicy(pin, this.policy); return pin;
    } catch (error) { throw safeError(error); }
  }

  async prepareSafeSnapshot(input: IngestionRequest, externalSignal?: AbortSignal,
    phase?: (stage: "downloading" | "inventorying") => Promise<void>): Promise<SafeSnapshotContext> {
    if (externalSignal?.aborted) throw new IngestionError("CANCELED");
    const parsed = IngestionRequestSchema.safeParse(input);
    if (!parsed.success) throw new IngestionError("INVALID_REQUEST");
    const request = parsed.data; const pin = await this.resolveSnapshot(request);
    if (this.scanner.version !== pin.policy.scanner) throw new IngestionError("POLICY_MISMATCH");
    const controller = new AbortController(); const signal = controller.signal; const contents = new Map<string, string>();
    const attemptId = randomUUID(); let leaseToken: string | undefined; let heartbeat: NodeJS.Timeout | undefined;
    let cleanupPromise: Promise<void> | undefined; let started = false; let closed = false; let context: FilteredContext | undefined;
    const relay = () => controller.abort(new IngestionError("CANCELED"));
    externalSignal?.addEventListener("abort", relay, { once: true }); if (externalSignal?.aborted) relay();
    const timeout = setTimeout(() => controller.abort(new IngestionError("TIMED_OUT")), pin.policy.limits.prepareTimeoutMs); timeout.unref();
    const deadline = setTimeout(() => controller.abort(new IngestionError("LEASE_LOST")), MAX_WORKSPACE_AGE_MS); deadline.unref();
    let checkpointPending: Promise<void> | undefined; let checkpointStartedAt = -Infinity;
    const checkpoint = async (fresh = true) => {
      checkSignal(signal);
      // Preparation boundaries and files() always require a live check. File
      // reads reuse it for at most the existing access-poll interval, avoiding
      // one remote round trip per file. Stale reads and the heartbeat share an
      // in-flight check, and failures/abort always invalidate the whole context.
      // Measure from request start so RPC latency cannot extend the window.
      if (!checkpointPending && (fresh || performance.now() - checkpointStartedAt >= ACCESS_POLL_MS)) {
        const startedAt = performance.now();
        checkpointPending = (async () => {
          try { await this.store.checkpoint(request.actor, attemptId, leaseToken!); checkpointStartedAt = startedAt; }
          catch (error) { controller.abort(safeError(error, "DATABASE_FAILURE")); }
          checkSignal(signal);
        })().finally(() => { checkpointPending = undefined; });
      }
      await checkpointPending;
      checkSignal(signal);
    };
    const cleanup = (): Promise<void> => {
      if (cleanupPromise) return cleanupPromise;
      closed = true;
      clearTimeout(timeout); clearTimeout(deadline); clearTimeout(heartbeat); externalSignal?.removeEventListener("abort", relay); contents.clear();
      cleanupPromise = (async () => {
        // Filesystem deletion comes first and does not require active access or a reachable database.
        if (started) await this.workspaces.dispose(attemptId);
        if (leaseToken) await this.store.dispose(request.actor, attemptId, leaseToken);
      })().catch(error => { cleanupPromise = undefined; throw safeError(error, "WORKSPACE_FAILURE"); });
      return cleanupPromise;
    };
    const poll = async () => {
      try { await checkpoint(); if (!closed) { heartbeat = setTimeout(() => { void poll(); }, ACCESS_POLL_MS); heartbeat.unref(); } }
      catch { controller.abort(new IngestionError("ACCESS_REVOKED")); }
    };
    const sensitive = (text: string) => {
      try { const result = this.scanner.isSensitive(text); if (typeof result !== "boolean") throw new Error(); return result; }
      catch { throw new IngestionError("SCANNER_FAILURE"); }
    };
    try {
      checkSignal(signal);
      leaseToken = await this.store.begin(request.actor, pin.pinId, attemptId);
      const workspace = await this.workspaces.create(attemptId, request.jobId); started = true;
      await checkpoint(); heartbeat = setTimeout(() => { void poll(); }, ACCESS_POLL_MS); heartbeat.unref();
      await phase?.("downloading");
      await this.source.download(request, pin, workspace.archive, signal, checkpoint).catch(error => { throw safeError(error); }); await checkpoint();
      await phase?.("inventorying");
      const archiveStat = await lstat(workspace.archive);
      if (!archiveStat.isFile() || archiveStat.isSymbolicLink() || archiveStat.size > pin.policy.limits.compressedBytes) throw new IngestionError("ARCHIVE_LIMIT");
      let ignoreText = "";
      await visitArchive(workspace.archive, pin.policy.limits, signal, entry => {
        if (entry.path !== ".repofyignore") return false;
        if (entry.size > 65536) throw new IngestionError("INVALID_IGNORE"); return true;
      }, (_entry, bytes) => { const decoded = decodeText(bytes); if (!("text" in decoded)) throw new IngestionError("INVALID_IGNORE"); ignoreText = decoded.text; });
      const ignored = ignoreMatcher(ignoreText); ignoreText = "";
      const excluded = Object.fromEntries(EXCLUSION_REASONS.map(key => [key, 0])) as ScanSummary["excluded"];
      const files: SafeFile[] = []; let textBytes = 0; let totalLines = 0;
      const stats = await visitArchive(workspace.archive, pin.policy.limits, signal, entry => {
        const reason = mandatoryExclusion(entry.path, pin.policy.version) ?? (entry.size > pin.policy.limits.fileBytes ? "oversized" : ignored(entry.path) ? "user_ignored" : undefined);
        if (reason) { excluded[reason]++; return false; } return true;
      }, (entry, bytes) => {
        const decoded = decodeText(bytes);
        if (!("text" in decoded)) { excluded[decoded.excluded]++; return; }
        const text = decoded.text;
        if (sensitive(entry.path) || sensitive(text)) { excluded.secret_or_sensitive_data++; return; }
        // Only schema/migration structure is eligible. Data-bearing SQL is never handed to an extractor.
        if (pin.policy.version === "1.1.0" && entry.path.toLowerCase().endsWith(".sql")
          && containsSqlData(text)) { excluded.secret_or_sensitive_data++; return; }
        if (/[@#]generated\b|\bDO NOT EDIT\b/.test(text.slice(0, 4096))) { excluded.generated++; return; }
        const lines = text ? text.split("\n").length : 0;
        textBytes += Buffer.byteLength(text); totalLines += lines;
        if (files.length >= pin.policy.limits.eligibleFiles || textBytes > pin.policy.limits.contextBytes || totalLines > pin.policy.limits.totalLines) throw new IngestionError("CONTEXT_LIMIT");
        const hash = this.crypto.fingerprintContent(text, pin.repositoryId); const locatorId = randomUUID();
        files.push({ locatorId, locator: { kind: "file", path: entry.path }, sizeBytes: bytes.length, lines,
          contentHash: hash.digest, contentHashKeyVersion: hash.keyVersion }); contents.set(locatorId, text);
      });
      const summary = ScanSummarySchema.parse({ ...stats, eligibleFiles: files.length, textBytes, totalLines, excluded,
        scope: stats.totalFiles === files.length ? "all_text" : "filtered", semanticAnalysis: "not_performed" });
      await checkpoint();
      await this.store.ready(request.actor, attemptId, leaseToken, pin, summary, files); await checkpoint();
      // Raw archive is no longer needed by any extractor. Remove it before handing out content.
      await this.workspaces.dispose(attemptId); started = false;
      context = new FilteredContext(pin, summary, files, contents, checkpoint, cleanup);
      signal.addEventListener("abort", () => { void context!.dispose().catch(() => undefined); }, { once: true });
      checkSignal(signal); clearTimeout(timeout); return context;
    } catch (error) { await cleanup(); checkSignal(signal); throw safeError(error, "ARCHIVE_INVALID"); }
  }

  /** Preferred worker entry point: callers cannot accidentally omit terminal disposal. */
  async withSafeSnapshot<T>(request: IngestionRequest, consume: (context: SafeSnapshotContext) => Promise<T>, signal?: AbortSignal,
    phase?: (stage: "downloading" | "inventorying") => Promise<void>): Promise<T> {
    const context = await this.prepareSafeSnapshot(request, signal, phase);
    try { return await consume(context); } finally { await context.dispose(); }
  }
  async disposeSnapshot(context: SafeSnapshotContext) { await context.dispose(); }
}

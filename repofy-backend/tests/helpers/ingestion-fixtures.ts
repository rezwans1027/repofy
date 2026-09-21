import { randomUUID } from "node:crypto";
import { gzipSync } from "node:zlib";
import { writeFile } from "node:fs/promises";
import { Header } from "tar";
import type { IngestionAccess, IngestionRequest, IngestionStore, PinnedSnapshot, SafeFile } from "../../src/domain/ingestion/repository";
import type { ScanSummary } from "../../src/domain/ingestion/policy";
import { IngestionError, checkSignal } from "../../src/domain/ingestion/errors";
import type { SnapshotSource } from "../../src/domain/ingestion/source";

export type TarFixtureEntry = { path: string; body?: string | Buffer; type?: Header['type']; linkpath?: string; size?: number };
export function rawTar(entries: TarFixtureEntry[]): Buffer {
  const blocks: Buffer[] = [];
  for (const entry of [{ path: "fixture-root/", type: "Directory" as const }, ...entries]) {
    const body = Buffer.from(entry.body ?? "");
    const header = new Header({ path: entry.path, type: entry.type ?? "File", size: entry.size ?? body.length,
      linkpath: entry.linkpath, mode: 0o777, uid: 0, gid: 0, mtime: new Date(0) });
    header.encode(); blocks.push(header.block!, body, Buffer.alloc((512 - body.length % 512) % 512));
  }
  blocks.push(Buffer.alloc(1024)); return Buffer.concat(blocks);
}
export function archiveFixture(entries: TarFixtureEntry[] = [{ path: "fixture-root/src/example.ts", body: "export const answer = 42;\n" }]) { return gzipSync(rawTar(entries)); }
export class MemoryIngestionStore implements IngestionStore {
  request: IngestionRequest = { actor: randomUUID(), jobId: randomUUID(), repositoryId: randomUUID() };
  grant: IngestionAccess = { accountId: randomUUID(), installationId: randomUUID(), grantId: randomUUID(), accessRevision: randomUUID(), providerRepositoryId: "300", repositoryVisibility: "private" };
  storedPin: PinnedSnapshot | null = null; revoked = false; canceled = false; readyCount = 0;
  attempts = new Map<string, { token: string; disposed: boolean; ready?: { summary: ScanSummary; files: SafeFile[] } }>();
  async access(request: IngestionRequest) {
    if (this.canceled) throw new IngestionError("CANCELED");
    if (this.revoked || JSON.stringify(request) !== JSON.stringify(this.request)) throw new IngestionError("ACCESS_REVOKED"); return this.grant;
  }
  async readPin(request: IngestionRequest) { await this.access(request); return this.storedPin; }
  async pin(request: IngestionRequest, pin: PinnedSnapshot) { await this.access(request); this.storedPin ??= structuredClone(pin); return structuredClone(this.storedPin); }
  async begin(actor: string, _pinId: string, attemptId: string) {
    if (actor !== this.request.actor || this.revoked) throw new IngestionError("ACCESS_REVOKED");
    const token = randomUUID(); this.attempts.set(attemptId, { token, disposed: false }); return token;
  }
  async checkpoint(actor: string, id: string, token: string) {
    await this.access({ ...this.request, actor }); const attempt = this.attempts.get(id);
    if (!attempt || attempt.token !== token || attempt.disposed) throw new IngestionError("LEASE_LOST");
  }
  async ready(actor: string, id: string, token: string, _pin: PinnedSnapshot, summary: ScanSummary, files: SafeFile[]) {
    await this.checkpoint(actor, id, token); this.attempts.get(id)!.ready = structuredClone({ summary, files }); this.readyCount++;
  }
  async dispose(_actor: string, id: string, token: string) { const a = this.attempts.get(id); if (a?.token === token) a.disposed = true; }
  async claimExpired(id: string) { return !this.attempts.has(id) || !!this.attempts.get(id)?.disposed; }
}
export class SyntheticSnapshotSource implements SnapshotSource {
  sha = "a".repeat(40); resolutions = 0; downloads: string[] = [];
  constructor(readonly store: MemoryIngestionStore, public archive = archiveFixture()) {}
  async resolve() { this.resolutions++; return { providerRepositoryId: "300", branch: "private-fixture-branch", commitSha: this.sha, repositoryVisibility: "private" as const }; }
  async download(_request: IngestionRequest, pin: PinnedSnapshot, destination: string, signal: AbortSignal, checkpoint: () => Promise<void>) {
    if (this.store.storedPin?.commitSha !== pin.commitSha) throw new Error("A pin must be durable before fetching");
    await checkpoint(); checkSignal(signal); this.downloads.push(pin.commitSha);
    await writeFile(destination, this.archive, { mode: 0o600, flag: "wx" });
  }
}

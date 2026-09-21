import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MemoryIngestionStore, SyntheticSnapshotSource, archiveFixture } from "./ingestion-fixtures";
import { fixtureCrypto, snapshotBundle } from "./evidence-fixtures";
import { SnapshotIngestionService } from "../../src/domain/ingestion/service";
import { WorkspaceManager } from "../../src/domain/ingestion/workspace";
import { policyHash, structuralSecurityPolicy } from "../../src/domain/ingestion/policy";
import { extractionProfile } from "../../src/domain/extraction/policy";
import { extractSnapshot, type SnapshotExtractionInput } from "../../src/domain/extraction/pipeline";

export async function extractionFixture(files: Record<string, string | Buffer>) {
  const root = await mkdtemp(join(tmpdir(), 'repofy-extract-')); const store = new MemoryIngestionStore(); const crypto = fixtureCrypto();
  const security = structuralSecurityPolicy();
  const source = new SyntheticSnapshotSource(store, archiveFixture(Object.entries(files).map(([path, body]) => ({ path: `fixture-root/${path}`, body }))));
  const service = new SnapshotIngestionService(store, source, crypto, new WorkspaceManager(root), security);
  const context = await service.prepareSafeSnapshot(store.request); const pin = store.storedPin!;
  const profile = extractionProfile(); const versions = { ...snapshotBundle(pin.repositoryId).versions, extractorBundle: profile.extractorBundle,
    detectorBundle: profile.detectorBundle, coverageManifest: profile.coverageManifest, ingestionPolicyHash: policyHash(security) };
  const input: SnapshotExtractionInput = { pin, crypto, versions, signal: new AbortController().signal, options: { commits: false, pullRequests: false, ci: false } };
  return { context, input, store, service, async extract(overrides: Partial<SnapshotExtractionInput> = {}) { return extractSnapshot(context, { ...input, ...overrides }); },
    async cleanup() { await context.dispose(); await rm(root, { recursive: true, force: true }); } };
}

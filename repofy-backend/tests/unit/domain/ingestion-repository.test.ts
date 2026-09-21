import { expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { IngestionRepository, type PinnedSnapshot } from "../../../src/domain/ingestion/repository";
import { policyHash, securityPolicy, EXCLUSION_REASONS } from "../../../src/domain/ingestion/policy";
import { bounded, IngestionError, safeError } from "../../../src/domain/ingestion/errors";
import { GitHubSnapshotSource } from "../../../src/domain/ingestion/source";
import { fixtureCrypto } from "../../helpers/evidence-fixtures";
import { MemoryIngestionStore } from "../../helpers/ingestion-fixtures";
import { fixtureRepository } from "../../helpers/github-app-fixtures";
import { GitHubAppError } from "../../../src/domain/github-app/errors";

function fixture() {
  const memory = new MemoryIngestionStore(); const { request } = memory; const crypto = fixtureCrypto(); const policy = securityPolicy();
  const pin: PinnedSnapshot = { jobId: request.jobId, repositoryId: request.repositoryId, ...memory.grant, pinId: randomUUID(),
    branch: "private-branch-sentinel", commitSha: "a".repeat(40), resolvedAt: new Date().toISOString(), policy, policyHash: policyHash(policy) };
  const { branch, ...fields } = pin;
  const encrypted = { ...fields, branchEncrypted: crypto.encryptBranch(branch, { repositoryId: pin.repositoryId, snapshotId: pin.pinId, locatorId: pin.pinId }) };
  return { request, pin, encrypted, crypto, access: memory.grant };
}
it("encrypts provenance and eligible locators before RPC and never transports raw text", async () => {
  const { request, pin, encrypted, crypto, access } = fixture();
  const rpc = vi.fn(async name => ({ data: name.endsWith("_pin") || name.endsWith("_read") ? encrypted : name.endsWith("_access") ? access : name.endsWith("_begin") ? randomUUID() : name.endsWith("_claim_expired") ? true : null, error: null }));
  const repository = new IngestionRepository({ rpc }, crypto);
  expect(await repository.access(request)).toEqual(access); expect(await repository.pin(request, pin)).toEqual(pin);
  expect(await repository.readPin(request)).toEqual(pin);
  const attempt = randomUUID(); const token = await repository.begin(request.actor, pin.pinId, attempt);
  await repository.checkpoint(request.actor, attempt, token);
  const hash = crypto.fingerprintContent("PRIVATE_SOURCE_SENTINEL", pin.repositoryId);
  await repository.ready(request.actor, attempt, token, pin, { archiveEntries: 2, totalFiles: 1, eligibleFiles: 1, textBytes: 23,
    totalLines: 1, decompressedBytes: 2048, excluded: Object.fromEntries(EXCLUSION_REASONS.map(k => [k, 0])) as never,
    scope: "all_text", semanticAnalysis: "not_performed" }, [{ locatorId: randomUUID(), locator: { kind: "file", path: "private-path-sentinel.ts" },
    sizeBytes: 23, lines: 1, contentHash: hash.digest, contentHashKeyVersion: hash.keyVersion }]);
  await repository.dispose(request.actor, attempt, token); expect(await repository.claimExpired(attempt)).toBe(true);
  expect(JSON.stringify(rpc.mock.calls)).not.toMatch(/private-branch-sentinel|private-path-sentinel|PRIVATE_SOURCE_SENTINEL/);
});
it("refuses tampered, incompatible and undecryptable pins", async () => {
  const { request, pin, encrypted, crypto } = fixture();
  const rpc = vi.fn(async () => ({ data: encrypted, error: null })); const repository = new IngestionRepository({ rpc }, crypto);
  await expect(repository.pin(request, { ...pin, policyHash: 'sha256:' + 'b'.repeat(64) })).rejects.toThrow('POLICY_MISMATCH'); expect(rpc).not.toHaveBeenCalled();
  rpc.mockResolvedValueOnce({ data: { ...encrypted, policyHash: 'sha256:' + 'b'.repeat(64) }, error: null });
  await expect(repository.readPin(request)).rejects.toThrow('POLICY_MISMATCH');
  rpc.mockResolvedValueOnce({ data: { ...encrypted, branchEncrypted: 'PRIVATE_CIPHERTEXT_SENTINEL' }, error: null });
  await expect(repository.readPin(request)).rejects.toThrow('POLICY_MISMATCH');
});
it("maps database diagnostics to fixed codes and enforces a stalled RPC deadline", async () => {
  const { request, crypto } = fixture();
  const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'PRIVATE_DATABASE_SENTINEL' } }); const repository = new IngestionRepository({ rpc }, crypto);
  await expect(repository.readPin(request)).rejects.toThrow('DATABASE_FAILURE');
  rpc.mockResolvedValueOnce({ data: null, error: { message: 'ACCESS_REVOKED' } }); await expect(repository.readPin(request)).rejects.toThrow('ACCESS_REVOKED');
  rpc.mockRejectedValueOnce(new Error('PRIVATE_DATABASE_SENTINEL')); await expect(repository.readPin(request)).rejects.toThrow('DATABASE_FAILURE');
  vi.useFakeTimers();
  try {
    rpc.mockImplementationOnce(() => new Promise(() => {})); const pending = expect(repository.readPin(request)).rejects.toThrow('DATABASE_FAILURE');
    await vi.advanceTimersByTimeAsync(5000); await pending;
  } finally { vi.useRealTimers(); }
});
it("uses fixed-code errors without inherited payloads and bounds provider resolution", async () => {
  const raw = Object.assign(new IngestionError('PROVIDER_FAILURE'), { privateSource: 'PRIVATE_SOURCE_SENTINEL' });
  expect(JSON.stringify(safeError(raw))).not.toContain('SENTINEL');
  await expect(bounded(Promise.resolve(42), 100)).resolves.toBe(42);
  await expect(bounded(new Promise(() => {}), 5)).rejects.toThrow('TIMED_OUT');
});
it.each(['changed repository', 'changed visibility', 'archived'])('rechecks %s before any archive request', async kind => {
  const { request, pin } = fixture(); const item = fixtureRepository();
  if (kind === 'changed repository') item.id = '301';
  if (kind === 'changed visibility') item.private = false;
  if (kind === 'archived') item.archived = true;
  const github = { withVerifiedRepositoryToken: async (...args: unknown[]) => (args.at(-1) as Function)({}, item) };
  const archive = { download: vi.fn() };
  const source = new GitHubSnapshotSource(github as never, archive as never);
  await expect(source.download(request, pin, '/unused', new AbortController().signal, async () => undefined)).rejects.toThrow('ACCESS_REVOKED');
  expect(archive.download).not.toHaveBeenCalled();
});
it("downloads only the saved SHA after a fresh repository check and resolves the live default only for a new pin", async () => {
  const { request, pin, access } = fixture(); const item = fixtureRepository(); item.default_branch = 'changed-branch';
  const github = { resolveDefaultCommit: vi.fn(async () => ({ branch: item.default_branch, commitSha: 'b'.repeat(40), providerRepositoryId: item.id, repositoryVisibility: 'private' })),
    withVerifiedRepositoryToken: async (...args: unknown[]) => (args.at(-1) as Function)({ token: 'ephemeral' }, item) };
  const archive = { download: vi.fn(async () => 123) }; const source = new GitHubSnapshotSource(github as never, archive as never);
  await source.download(request, pin, '/unused', new AbortController().signal, async () => undefined);
  expect(archive.download.mock.calls[0][0]).toEqual({ owner: item.owner.login, name: item.name, commitSha: pin.commitSha });
  expect(github.resolveDefaultCommit).not.toHaveBeenCalled();
  expect((await source.resolve(request, access)).commitSha).toBe('b'.repeat(40));
});
it.each(['installation_suspended', 'insufficient_permissions', 'access_changed', 'provider_unavailable'] as const)('preserves a safe failure category for %s', async code => {
  const { request, pin, access } = fixture(); const fail = async () => { throw new GitHubAppError(code); };
  const source = new GitHubSnapshotSource({ resolveDefaultCommit: fail, withVerifiedRepositoryToken: fail } as never);
  const expected = code === 'provider_unavailable' ? 'PROVIDER_FAILURE' : 'ACCESS_REVOKED';
  await expect(source.resolve(request, access)).rejects.toThrow(expected);
  await expect(source.download(request, pin, '/unused', new AbortController().signal, async () => undefined)).rejects.toThrow(expected);
});

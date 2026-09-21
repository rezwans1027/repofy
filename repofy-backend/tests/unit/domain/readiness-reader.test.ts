import { expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { ReadinessReader } from '../../../src/domain/readiness/reader';
import { GitHubAppError } from '../../../src/domain/github-app/errors';
import { fixtureCrypto } from '../../helpers/evidence-fixtures';

function fixture() {
  const actor = randomUUID(), report = randomUUID(), evidence = randomUUID(), crypto = fixtureCrypto();
  const data = { evidenceId: evidence, snapshotId: randomUUID(), repositoryId: randomUUID(), commitSha: 'a'.repeat(40), visibility: 'public',
    grantId: randomUUID(), accessRevision: randomUUID(), accountId: randomUUID(), installationId: randomUUID(), providerRepositoryId: '300', locatorId: randomUUID(), locatorEncrypted: '' };
  data.locatorEncrypted = crypto.protectLocator({ kind: 'file', path: 'safe folder/file.ts', lines: { start: 2, end: 4 } }, data).locatorEncrypted;
  const rpc = vi.fn(async () => ({ data, error: null } as { data: unknown; error: { message: string } | null }));
  const verifyRepository = vi.fn(async () => ({ item: { id: '300', owner: { login: 'fixture' }, name: 'repo', private: false } } as never));
  const reader = new ReadinessReader({ rpc }, () => crypto, { verifyRepository });
  return { actor, report, evidence, crypto, data, rpc, verifyRepository, reader };
}
it('returns fixed location states on provider or decryption failure without revealing exception text', async () => {
  const f = fixture(); f.verifyRepository.mockRejectedValueOnce(new Error('PRIVATE_SOURCE_SENTINEL'));
  expect(await f.reader.location(f.actor, f.report, f.evidence)).toEqual({ state: 'unavailable', evidenceId: f.evidence });
  f.data.locatorEncrypted = 'PRIVATE_SOURCE_SENTINEL'; expect(await f.reader.location(f.actor, f.report, f.evidence)).toEqual({ state: 'unavailable', evidenceId: f.evidence });
});
it('checks provider identity and grant revision again before decrypting locators', async () => {
  const f = fixture(); f.verifyRepository.mockResolvedValueOnce({ item: { id: '301' } } as never);
  expect((await f.reader.location(f.actor, f.report, f.evidence)).state).toBe('access_revoked');
  f.rpc.mockResolvedValueOnce({ data: f.data, error: null }).mockResolvedValueOnce({ data: { ...f.data, accessRevision: randomUUID() }, error: null });
  expect((await f.reader.location(f.actor, f.report, f.evidence)).state).toBe('access_revoked');
});
it('does not invent a file location for provider metadata', async () => {
  const f = fixture(); f.data.locatorEncrypted = f.crypto.protectLocator({ kind: 'provider_metadata', providerObjectId: '123', commitRelationship: 'exact_commit' }, f.data).locatorEncrypted;
  expect((await f.reader.location(f.actor, f.report, f.evidence)).state).toBe('not_retained');
});
it('honors a newly private provider response and never exposes a private link', async () => {
  const f = fixture(); f.verifyRepository.mockResolvedValueOnce({ item: { id: '300', owner: { login: 'fixture' }, name: 'repo', private: true } } as never);
  const value = await f.reader.location(f.actor, f.report, f.evidence); expect(value).toMatchObject({ state: 'available', visibility: 'private' }); expect(value).not.toHaveProperty('url');
  f.verifyRepository.mockRejectedValueOnce(new GitHubAppError('reconnect_required')); expect((await f.reader.location(f.actor, f.report, f.evidence)).state).toBe('access_revoked');
});
it('rejects unsafe provider names instead of forwarding arbitrary links or exceptions', async () => {
  const f = fixture(); f.verifyRepository.mockResolvedValueOnce({ item: { id: '300', owner: { login: 'evil/../host' }, name: 'repo', private: false } } as never);
  expect((await f.reader.location(f.actor, f.report, f.evidence)).state).toBe('unavailable');
});
it('deletes through an owner-scoped mutation without parsing or regenerating report content', async () => {
  const f = fixture(); f.rpc.mockResolvedValueOnce({ data: { deleted: true }, error: null });
  const requestId = randomUUID(); expect(await f.reader.remove(f.actor, f.report, requestId)).toEqual({ deleted: true });
  expect(f.rpc).toHaveBeenCalledExactlyOnceWith('feature_one_report_delete', { p_actor: f.actor, p_report: f.report, p_request_id: requestId }); expect(f.verifyRepository).not.toHaveBeenCalled();
});
it('bounds inputs and converts database failures to closed errors', async () => {
  const f = fixture(); await expect(f.reader.history(f.actor, { limit: 51 })).rejects.toMatchObject({ code: 'INVALID_REQUEST' }); expect(f.rpc).not.toHaveBeenCalled();
  f.rpc.mockRejectedValueOnce(new Error('PRIVATE_SOURCE_SENTINEL')); await expect(f.reader.history(f.actor, {})).rejects.toMatchObject({ message: 'DATABASE_FAILURE' });
  for (const [message, code] of [['PRIVATE_SOURCE_SENTINEL', 'DATABASE_FAILURE'], ['ACCESS_REVOKED', 'REPOSITORY_ACCESS_REVOKED'], ['INVALID_REQUEST', 'INVALID_REQUEST']]) {
    f.rpc.mockResolvedValueOnce({ data: null, error: { message } }); await expect(f.reader.history(f.actor, {})).rejects.toMatchObject({ code });
  }
});

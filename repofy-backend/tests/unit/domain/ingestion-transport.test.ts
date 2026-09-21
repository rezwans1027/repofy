import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm, lstat, open } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { GitHubArchiveClient } from "../../../src/domain/ingestion/github-archive";
import { IngestionError } from "../../../src/domain/ingestion/errors";
import { staticSecretScanner } from "../../../src/domain/ingestion/scanner";
import { isGitHubConnectionTelemetry } from "../../../src/lib/sentry";
import { archiveFixture } from "../../helpers/ingestion-fixtures";

vi.mock('node:fs/promises', async importOriginal => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return { ...actual, open: vi.fn(actual.open) };
});

let root: string; const sha = 'a'.repeat(40); const coordinates = { owner: 'fixture', name: 'private-repository', commitSha: sha };
const url = `https://codeload.github.com/fixture/private-repository/legacy.tar.gz/${sha}`;
const credential = () => ({ token: 'PRIVATE_TOKEN_SENTINEL', expiresAt: new Date(Date.now() + 3600000).toISOString(), assertValid: vi.fn() });
beforeEach(async () => { root = await mkdtemp(join(tmpdir(), 'repofy-transport-test-')); });
afterEach(async () => { await rm(root, { recursive: true, force: true }); });
it('streams a commit-specific archive with private permissions and strips credentials on codeload', async () => {
  const bytes = archiveFixture(); const token = credential(); const checkpoint = vi.fn(async () => undefined);
  const fetcher = vi.fn().mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: url + '?token=TEMP_URL_SENTINEL' } }))
    .mockResolvedValueOnce(new Response(bytes, { headers: { 'content-length': String(bytes.length) } }));
  const output = join(root, 'archive.tgz');
  expect(await new GitHubArchiveClient(fetcher).download(coordinates, token, output, 1024 * 1024, new AbortController().signal, checkpoint)).toBe(bytes.length);
  expect(fetcher.mock.calls[0][0].toString()).toBe(`https://api.github.com/repos/fixture/private-repository/tarball/${sha}`);
  expect(fetcher.mock.calls[0][1].headers.Authorization).toBe('Bearer PRIVATE_TOKEN_SENTINEL');
  expect(fetcher.mock.calls[1][1].headers).not.toHaveProperty('Authorization'); expect(fetcher.mock.calls[1][1].credentials).toBe('omit');
  expect((await lstat(output)).mode & 0o777).toBe(0o600); expect(await readFile(output)).toEqual(bytes);
  expect(checkpoint).toHaveBeenCalledTimes(3); expect(isGitHubConnectionTelemetry(url + '?token=TEMP_URL_SENTINEL')).toBe(true);
});
it.each([
  'http://codeload.github.com/fixture/private-repository/legacy.tar.gz/' + sha,
  'https://codeload.github.com.evil.example/fixture/private-repository/legacy.tar.gz/' + sha,
  'https://user:pass@codeload.github.com/fixture/private-repository/legacy.tar.gz/' + sha,
  'https://127.0.0.1/archive', 'https://github.com/archive', 'https://api.github.com/archive',
  url.replace(sha, 'main'), url.replace('private-repository', 'other'), url + '?callback=https://evil.example', url + '#fragment',
])('rejects an untrusted/changed redirect without a second request: %s', async location => {
  const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location } }));
  await expect(new GitHubArchiveClient(fetcher).download(coordinates, credential(), join(root, 'a'), 2048, new AbortController().signal, async () => undefined)).rejects.toThrow('UNSAFE_REDIRECT');
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it('bounds redirect chains and rejects branch refs before transport', async () => {
  const fetcher = vi.fn().mockImplementation(async () => new Response(null, { status: 302, headers: { location: url } }));
  const client = new GitHubArchiveClient(fetcher);
  await expect(client.download(coordinates, credential(), join(root, 'a'), 2048, new AbortController().signal, async () => undefined)).rejects.toThrow('UNSAFE_REDIRECT');
  expect(fetcher).toHaveBeenCalledTimes(3);
  fetcher.mockClear();
  await expect(client.download({ ...coordinates, commitSha: 'main' }, credential(), join(root, 'a'), 2048, new AbortController().signal, async () => undefined)).rejects.toThrow('INVALID_REQUEST');
  expect(fetcher).not.toHaveBeenCalled();
});
it.each(['declared size', 'streamed size', 'interruption', 'content encoding', 'provider body', 'existing target'])('stops %s and never returns upstream details', async mode => {
  let response: Response;
  if (mode === 'interruption') response = new Response(new ReadableStream({ start(controller) { controller.error(new Error('PRIVATE_SOURCE_SENTINEL')); } }));
  else response = new Response(mode === 'provider body' ? 'PRIVATE_SOURCE_SENTINEL' : Buffer.alloc(4096), {
    status: mode === 'provider body' ? 403 : 200, headers: mode === 'declared size' ? { 'content-length': '9000' } : mode === 'content encoding' ? { 'content-encoding': 'gzip' } : {},
  });
  const client = new GitHubArchiveClient(vi.fn().mockResolvedValue(response));
  const destination = mode === 'existing target' ? root : join(root, 'a');
  let error: unknown; try { await client.download(coordinates, credential(), destination, mode === 'streamed size' ? 1024 : 8192, new AbortController().signal, async () => undefined); } catch (e) { error = e; }
  expect(error).toBeInstanceOf(IngestionError); expect(JSON.stringify(error)).not.toContain('SENTINEL');
});
it('closes the file and cancels the response when a write reports ENOSPC', async () => {
  const close = vi.fn(async () => undefined); const cancel = vi.fn();
  vi.mocked(open).mockResolvedValueOnce({ writeFile: async () => { throw Object.assign(new Error('PRIVATE_PATH_SENTINEL'), { code: 'ENOSPC' }); }, close } as never);
  const response = new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array([1, 2])); }, cancel }));
  await expect(new GitHubArchiveClient(vi.fn().mockResolvedValue(response)).download(coordinates, credential(), join(root, 'a'), 8192,
    new AbortController().signal, async () => undefined)).rejects.toThrow('WORKSPACE_FAILURE');
  expect(close).toHaveBeenCalled(); expect(cancel).toHaveBeenCalled();
});
it('aborts an idle response body on cancellation', async () => {
  const abort = new AbortController(); const cancel = vi.fn();
  const client = new GitHubArchiveClient(vi.fn().mockResolvedValue(new Response(new ReadableStream({ cancel }))));
  const pending = client.download(coordinates, credential(), join(root, 'a'), 8192, abort.signal, async () => undefined);
  setTimeout(() => abort.abort(), 20); await expect(pending).rejects.toThrow('CANCELED'); expect(cancel).toHaveBeenCalled();
});
it.each([
  '-----BEGIN RSA PRIVATE KEY-----', 'aws_secret_access_key = abcdef',
  'password="correct-horse-battery"', 'client_secret: "AbCd1234_EfGh5678"',
  'postgres://user:password@db.example/table', 'Authorization: Bearer abcdef',
  'contact = person@example.test', '111-22-3333', '4111 1111 1111 1111',
  'AIza' + 'a'.repeat(35), 'xoxb-' + 'a'.repeat(20), 'sk-proj-' + 'a1'.repeat(25),
  'eyJabcd123456.abcdefgh123456.abcdefgh123456',
  'AbC0dEf1GhI2jKl3MnO4pQr5StU6vWx7Yz89',
])('filters likely secrets/sensitive data conservatively', text => { expect(staticSecretScanner.isSensitive(text)).toBe(true); });
it('allows static code and environment references without scanner configuration or suppressions', () => {
  expect(staticSecretScanner.isSensitive('const value = 42;\nconst password = process.env.PASSWORD;')).toBe(false);
  expect(staticSecretScanner.isSensitive('// secretlint-disable\nconst token = "A12345B67890";')).toBe(true);
});

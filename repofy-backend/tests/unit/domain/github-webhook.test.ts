import { createHmac, randomUUID } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";
import { GitHubWebhookService } from "../../../src/domain/github-app/webhook";
import { readFeatureOneConfig } from "../../../src/config/feature-one";

const secret = 'fixture-webhook-secret';
const rpc = vi.fn();
const service = new GitHubWebhookService({ rpc }, secret);
const body = Buffer.from('{ "action": "removed", "installation": {"id": 500}, "repositories_removed": [{"id":300,"name":"PRIVATE-SENTINEL"}] }');
const signature = (input = body) => 'sha256=' + createHmac('sha256', secret).update(input).digest('hex');
beforeEach(() => rpc.mockReset().mockResolvedValue({ data: false, error: null }));
it('verifies original bytes and passes only minimal event effects and hashed receipt metadata', async () => {
  expect(await service.receive(body, signature(), randomUUID(), 'installation_repositories')).toEqual({ received: true, duplicate: false });
  const args = rpc.mock.calls[0][1];
  expect(args).toMatchObject({ p_event: 'installation_repositories', p_action: 'removed', p_installation: '500', p_repositories: ['300'] });
  expect(JSON.stringify(args)).not.toMatch(/PRIVATE-SENTINEL|sha256=|fixture-webhook/);
  await expect(service.receive(Buffer.from(JSON.stringify(JSON.parse(body.toString()))), signature(), randomUUID(), 'installation_repositories')).rejects.toMatchObject({ status: 401 });
});
it.each([undefined, '', 'sha256=00', 'sha1=' + 'a'.repeat(40), 'sha256=' + '0'.repeat(64)])('rejects invalid signature %s before database access', async sig => {
  await expect(service.receive(body, sig, randomUUID(), 'installation_repositories')).rejects.toMatchObject({ status: 401 });
  expect(rpc).not.toHaveBeenCalled();
});
it('rejects invalid headers, malformed JSON, missing effects, and missing configured secret', async () => {
  await expect(service.receive(body, signature(), 'forged', 'installation_repositories')).rejects.toMatchObject({ status: 400 });
  await expect(service.receive(body, signature(), randomUUID(), ['installation'])).rejects.toMatchObject({ status: 400 });
  const invalid = Buffer.from('{');
  await expect(service.receive(invalid, signature(invalid), randomUUID(), 'installation')).rejects.toMatchObject({ status: 400 });
  const incomplete = Buffer.from('{"action":"revoked"}');
  await expect(service.receive(incomplete, signature(incomplete), randomUUID(), 'github_app_authorization')).rejects.toMatchObject({ status: 400 });
  await expect(new GitHubWebhookService({ rpc }, '').receive(body, signature(), randomUUID(), 'installation')).rejects.toMatchObject({ status: 503 });
  expect(rpc).not.toHaveBeenCalled();
});
it('acknowledges exact duplicates, safely ignores unrelated events, and surfaces database errors without provider content', async () => {
  rpc.mockResolvedValueOnce({ data: true, error: null });
  expect((await service.receive(body, signature(), randomUUID(), 'installation_repositories')).duplicate).toBe(true);
  await service.receive(body, signature(), randomUUID(), 'push');
  expect(rpc.mock.calls[1][1]).toMatchObject({ p_event: 'ignored', p_installation: null, p_repositories: [] });
  rpc.mockResolvedValue({ data: null, error: { message: 'PRIVATE-SENTINEL' } });
  await expect(service.receive(body, signature(), randomUUID(), 'installation_repositories')).rejects.toMatchObject({ status: 503, message: 'GitHub delivery could not be processed.' });
});
it('retains webhook verification configuration with all discovery flags disabled', () => {
  const config = readFeatureOneConfig({ GITHUB_APP_WEBHOOK_SECRET: secret });
  expect(config.flags.featureOneEnabled).toBe(false); expect(config.githubApp).toBeUndefined();
  expect(config.githubWebhookSecret).toBe(secret); expect(config.maxRepositories).toBe(5);
  expect(readFeatureOneConfig({ GITHUB_APP_WEBHOOK_SECRET: "<replace-me>" }).githubWebhookSecret).toBeUndefined();
  for (const value of ['0', '11', 'five', '2.5']) expect(() => readFeatureOneConfig({ FEATURE_ONE_MAX_REPOSITORIES: value })).toThrow(/MAX_REPOSITORIES/);
});
it('scopes repository access events to their repository and never accepts a missing repository reference', async () => {
  const raw = Buffer.from(JSON.stringify({ action: 'privatized', installation: { id: 500 }, repository: { id: 300, name: 'PRIVATE-SENTINEL' } }));
  await service.receive(raw, signature(raw), randomUUID(), 'repository');
  expect(rpc.mock.calls[0][1]).toMatchObject({ p_event: 'repository', p_repositories: ['300'] });
  const absent = Buffer.from(JSON.stringify({ action: 'privatized', installation: { id: 500 } }));
  await expect(service.receive(absent, signature(absent), randomUUID(), 'repository')).rejects.toMatchObject({ status: 400 });
});

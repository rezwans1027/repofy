import { beforeEach, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { REPOSITORY_ATTESTATION_TEXT, GitHubRepositorySummarySchema, type SavedRepositorySelection } from '@repofy/contracts';
import { RepositoryPicker } from './repository-picker';
import { api, ApiError } from '@/lib/api-client';
import { useAuth } from '@/components/providers/auth-provider';
vi.mock('@/lib/api-client', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/api-client')>(), api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }));
vi.mock('@/components/providers/auth-provider', () => ({ useAuth: vi.fn() }));
const id = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, '0')}`;
const accountId = id(1); const installationId = id(2);
const candidate = (n: number) => GitHubRepositorySummarySchema.parse({ repositoryId: id(n), accountId, installationId, fullName: `fixture-org/private-${n}`, visibility: 'private' as const, defaultBranch: 'main', archived: false });
const initial = (): SavedRepositorySelection => ({ revision: id(3), repositories: [], policy: { maxRepositories: 2, attestationVersion: '1.0.0', attestationText: REPOSITORY_ATTESTATION_TEXT, allowArchived: false, requireDefaultBranch: true, analysisAvailable: false } });
const page = { status: 'complete', nextCursor: null, issues: [], connectPath: '/api/v1/github/installations/start' };
let saved: SavedRepositorySelection;
let client: QueryClient;
function view(connectionStatus?: string) { return <QueryClientProvider client={client}><RepositoryPicker connectionStatus={connectionStatus} /></QueryClientProvider>; }
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }); saved = initial();
  vi.mocked(useAuth).mockReturnValue({ user: { id: id(10), email: 'fixture@example.test' }, isLoading: false, refresh: vi.fn() });
  vi.mocked(api.get).mockReset().mockImplementation(async path => {
    if (path === '/v1/repository-selections') return saved;
    if (path === '/v1/github/accounts') return { accounts: [{ accountId, login: 'fixture', status: 'connected', verifiedAt: '2026-09-19T00:00:00Z' }], connectPath: page.connectPath };
    if (path.startsWith('/v1/github/installations?')) return { ...page, installations: [{ installationId, accountId, ownerLogin: 'fixture-org', ownerType: 'Organization', status: 'active', selection: 'selected', permissions: { contents: 'read' } }] };
    if (path.startsWith('/v1/repositories?')) return { ...page, nextCursor: path.includes('cursor=') ? null : 'synthetic-next-cursor', repositories: path.includes('cursor=') ? [candidate(20), candidate(21), candidate(22)] : [candidate(20)] };
    throw new Error('Unexpected path');
  });
  vi.mocked(api.post).mockReset().mockImplementation(async (_path, options) => {
    const body = options?.body as { repositories: { repositoryId: string }[] };
    saved = { ...initial(), revision: id(4), repositories: body.repositories.map(item => ({ ...candidate(Number(item.repositoryId.slice(-2))), ownerType: 'Organization', grantId: id(40 + Number(item.repositoryId.slice(-2))), accessRevision: id(41), status: 'active', attestedAt: '2026-09-19T00:00:00Z' })) };
    return saved;
  });
  vi.mocked(api.delete).mockReset().mockImplementation(async () => { saved = { ...initial(), revision: id(5) }; return saved; });
});
async function discover() {
  const user = userEvent.setup();
  await screen.findByText('No saved repository access.');
  await screen.findByRole('option', { name: 'fixture — connected' });
  await user.selectOptions(screen.getByLabelText('GitHub identity'), accountId);
  await screen.findByRole('option', { name: /fixture-org/ });
  await user.selectOptions(screen.getByLabelText('Installation'), installationId);
  await screen.findByRole('checkbox', { name: /private-20/ }); return user;
}
it('keeps stable choices across pagination/search, enforces the server limit and requires keyboard consent', async () => {
  render(view()); const user = await discover();
  const first = screen.getByRole('checkbox', { name: /private-20/ }); first.focus(); await user.keyboard('[Space]');
  await user.click(screen.getByRole('button', { name: 'Load more repositories' }));
  expect(await screen.findAllByRole('checkbox', { name: /private-20/ })).toHaveLength(1);
  await user.type(screen.getByLabelText('Search loaded repositories'), '21');
  await user.click(screen.getByRole('checkbox', { name: /private-21/ }));
  expect(screen.getByRole('heading', { name: 'Selection (2/2)' })).toBeInTheDocument();
  await user.clear(screen.getByLabelText('Search loaded repositories'));
  expect(screen.getByRole('checkbox', { name: /private-22/ })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Save selection' })).toBeDisabled();
  const consent = screen.getByRole('checkbox', { name: REPOSITORY_ATTESTATION_TEXT }); consent.focus(); await user.keyboard('[Space]');
  await user.click(screen.getByRole('button', { name: 'Save selection' }));
  await screen.findByRole('button', { name: 'Remove access to fixture-org/private-20' });
  expect(api.post).toHaveBeenCalledWith('/v1/repository-selections', expect.objectContaining({ body: expect.objectContaining({ attestation: { version: '1.0.0', accepted: true } }) }));
  expect(screen.getByRole('button', { name: 'Start Analysis' })).toBeDisabled();
});
it('shows persisted revoked access and supports audited removal without reselecting it', async () => {
  saved.repositories = [{ ...candidate(20), ownerType: 'Organization', grantId: id(40), accessRevision: id(41), status: 'revoked', attestedAt: '2026-09-19T00:00:00Z' }];
  render(view()); const user = userEvent.setup();
  expect(await screen.findByText(/Access revoked/)).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Selection (0/2)' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Remove access to fixture-org/private-20' }));
  await screen.findByText('No saved repository access.');
  expect(api.delete).toHaveBeenCalledWith(`/v1/repository-selections/${id(40)}`, expect.anything());
});
it('shows stable revoked-access errors and refresh recovery', async () => {
  vi.mocked(api.post).mockRejectedValue(new ApiError('Access changed during save.', 403, { code: 'REPOSITORY_ACCESS_REVOKED', retryable: false, requestId: 'fixture' }));
  render(view()); const user = await discover();
  await user.click(screen.getByRole('checkbox', { name: /private-20/ }));
  await user.click(screen.getByRole('checkbox', { name: REPOSITORY_ATTESTATION_TEXT }));
  await user.click(screen.getByRole('button', { name: 'Save selection' }));
  expect(await screen.findByText('Access was revoked. Refresh before selecting repositories again.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Refresh access and saved selection' })).toBeEnabled();
});
it('drops private selections and cached queries immediately on account switch', async () => {
  const rendered = render(view()); const user = await discover();
  await user.click(screen.getByRole('checkbox', { name: /private-20/ }));
  vi.mocked(useAuth).mockReturnValue({ user: { id: id(99), email: 'second@example.test' }, isLoading: false, refresh: vi.fn() });
  vi.mocked(api.get).mockImplementation(async path => path === '/v1/repository-selections' ? initial() : { accounts: [], connectPath: page.connectPath });
  rendered.rerender(view());
  await screen.findByText(/No GitHub identities connected/);
  expect(screen.queryByText('fixture-org/private-20')).not.toBeInTheDocument();
  expect(client.getQueryCache().findAll({ queryKey: ['repository-access', id(10)] })).toHaveLength(0);
});
it('reuses the same idempotency key when retrying an uncertain save', async () => {
  vi.mocked(api.post).mockRejectedValue(new Error('Network disconnected'));
  render(view()); const user = await discover();
  await user.click(screen.getByRole('button', { name: 'Save selection' }));
  await screen.findByRole('alert');
  await user.click(screen.getByRole('button', { name: 'Save selection' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
  expect(vi.mocked(api.post).mock.calls[0][1]?.body).toEqual(vi.mocked(api.post).mock.calls[1][1]?.body);
});
it('shows organization approval guidance and a keyboard accessible installation management link', async () => {
  window.history.replaceState({}, '', '/readiness/new?github=pending_approval');
  render(view('pending_approval')); await screen.findByText(/An organization owner must approve/);
  expect(screen.getByRole('link', { name: 'Manage GitHub installations' })).toHaveAttribute('href', 'https://github.com/settings/installations');
  window.history.replaceState({}, '', '/');
});
it('does not request private data without an authenticated user', async () => {
  vi.mocked(useAuth).mockReturnValue({ user: null, isLoading: false, refresh: vi.fn() });
  render(view()); await act(async () => {});
  expect(screen.getByText('Sign in to manage repository access.')).toBeInTheDocument(); expect(api.get).not.toHaveBeenCalled();
});
it('ignores a save response that arrives after the authenticated account changes', async () => {
  let finish!: (value: SavedRepositorySelection) => void;
  vi.mocked(api.post).mockImplementation(() => new Promise(resolve => { finish = resolve as typeof finish; }));
  const rendered = render(view()); const user = await discover();
  await user.click(screen.getByRole('checkbox', { name: /private-20/ }));
  await user.click(screen.getByRole('checkbox', { name: REPOSITORY_ATTESTATION_TEXT }));
  await user.click(screen.getByRole('button', { name: 'Save selection' }));
  expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
  vi.mocked(useAuth).mockReturnValue({ user: { id: id(99), email: 'second@example.test' }, isLoading: false, refresh: vi.fn() });
  vi.mocked(api.get).mockImplementation(async path => path === '/v1/repository-selections' ? initial() : { accounts: [], connectPath: page.connectPath });
  rendered.rerender(view()); await screen.findByText(/No GitHub identities connected/);
  await act(async () => { finish({ ...initial(), revision: id(7), repositories: [{ ...candidate(20), ownerType: 'Organization', grantId: id(40), accessRevision: id(41), status: 'active', attestedAt: '2026-09-19T00:00:00Z' }] }); });
  expect(screen.queryByText('fixture-org/private-20')).not.toBeInTheDocument();
  expect(client.getQueryCache().findAll({ queryKey: ['repository-access', id(10)] })).toHaveLength(0);
});

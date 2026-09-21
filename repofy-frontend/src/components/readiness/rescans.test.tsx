import { beforeEach, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { axe } from 'vitest-axe';
import { ComparisonSchema, REPOSITORY_ATTESTATION_TEXT, type RoleFocus } from '@repofy/contracts';
import { useAuth } from '@/components/providers/auth-provider';
import { readinessView, fixtureId } from '@/__tests__/fixtures/readiness-view';
import { navState } from '@/__tests__/helpers/mock-navigation';
import { useRoleFocus } from './role-focus';
import { RescanPanel } from './rescan-panel';
import { ReportComparison } from './report-comparison';
import { ReadinessOwner } from './report-shared';
vi.mock('@/components/providers/auth-provider', () => ({ useAuth: vi.fn() }));
let view: ReturnType<typeof readinessView>, client: QueryClient, focus: RoleFocus;
const success = (data: unknown) => Response.json({ success: true, data });
function wrap(node: React.ReactNode) { return <QueryClientProvider client={client}>{node}</QueryClientProvider>; }
function Focus({ actor }: { actor: string }) {
  const { control, ordered } = useRoleFocus(actor, view);
  return <>{control}<output aria-label="First role">{ordered.report.roles[0].template.roleId}</output></>;
}
function focused() { return wrap(<ReadinessOwner>{actor => <Focus key={actor} actor={actor} />}</ReadinessOwner>); }
function comparison() {
  const snapshot = view.report.snapshots[0], stamp = { snapshotId: snapshot.snapshotId, commitSha: snapshot.commitSha, capturedAt: snapshot.createdAt, access: 'active', visibility: 'private' };
  return ComparisonSchema.parse({ algorithm: 'evidence-diff-1.0.0', baseline: { reportId: view.report.reportId, createdAt: view.report.createdAt, versions: view.report.versions },
    target: { reportId: fixtureId(70), createdAt: view.report.createdAt, versions: view.report.versions }, comparability: 'limited', causes: ['scope_changed'],
    notes: ['A newly excluded path does not establish a regression.'], repositories: [{ repositoryId: snapshot.repositoryId, label: 'Repository 1', baseline: stamp, target: stamp }],
    counts: { gained: 1, lost: 0, changed: 0, relocated: 0, unchanged: 0, uncertain: 0 },
    capabilities: [{ capabilityId: 'testing', label: 'Testing', baseline: { state: 'assessed', strength: .55, confidence: .55, assessableFraction: 1 }, target: { state: 'assessed', strength: .65, confidence: .55, assessableFraction: 1 }, strengthDelta: .1, confidenceDelta: 0, assessabilityChanged: false }],
    roles: view.report.roles.map(r => ({ roleId: r.template.roleId, baseline: null, target: null, coverageDelta: null, confidenceDelta: null, baselineUnknownWeight: 1, targetUnknownWeight: 1 })),
    evidence: [{ repositoryId: snapshot.repositoryId, change: 'gained', baselineEvidenceId: null, targetEvidenceId: view.report.evidence[0].evidenceId, detector: 'test_detector', sourceType: 'test', capabilityIds: ['testing'], basis: 'unmatched', interpretation: 'limited_by_scope_or_versions' }],
    filteredCount: 31, nextOffset: 30 });
}
beforeEach(() => {
  view = readinessView(); sessionStorage.clear(); navState.push.mockClear();
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  vi.mocked(useAuth).mockReturnValue({ user: { id: view.report.ownerUserId, email: 'fixture@example.test' }, isLoading: false, refresh: vi.fn() });
  focus = { reportId: view.report.reportId, role: null, policy: 'recorded-role-order-1.0.0', capabilityOrder: ['testing','mobile','api'], improvementOrder: view.report.improvements.map(i => i.improvementId), roleOrder: view.report.roles.map(r => r.template.roleId), gapOrder: [] };
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, options) => {
    const url = String(input);
    if (url.includes('/comparisons?')) return success(comparison());
    if (url.endsWith('/focus')) {
      if (options?.method === 'PUT') { focus.role = JSON.parse(options.body as string).role; focus.roleOrder = [focus.role!.roleId, ...focus.roleOrder.filter(id => id !== focus.role!.roleId)]; }
      return success(focus);
    }
    if (url.endsWith('/availability')) return success({ available: true });
    if (url.endsWith('/repository-selections')) return success({ revision: fixtureId(40), policy: { maxRepositories: 5, attestationVersion: '1.0.0', attestationText: REPOSITORY_ATTESTATION_TEXT, allowArchived: false, requireDefaultBranch: true, analysisAvailable: true },
      repositories: [{ repositoryId: view.report.snapshots[0].repositoryId, accountId: fixtureId(41), installationId: fixtureId(42), fullName: 'PRIVATE_NAME_SENTINEL/project', visibility: 'private', defaultBranch: 'main', archived: false, ownerType: 'Organization', grantId: fixtureId(43), accessRevision: fixtureId(44), status: 'active', attestedAt: '2026-09-19T00:00:00Z' }] });
    if (options?.method === 'POST') return success({ state: 'unchanged', reportId: view.report.reportId, charge: 'none' });
    if (url.includes('/rescans?')) return success({ parent: { state: 'none' }, items: [], nextId: null });
    throw new Error('Unexpected fixture request');
  });
});
it('persists the recorded role through PUT, reorders the view and preserves the input report', async () => {
  const before = JSON.stringify(view); render(focused()); await waitFor(() => expect(screen.getByRole('combobox')).toBeEnabled());
  await userEvent.selectOptions(screen.getByRole('combobox'), 'mobile'); await screen.findByText('Role focus saved separately from your report.');
  expect(screen.getByLabelText('First role')).toHaveTextContent('mobile'); expect(JSON.stringify(view)).toBe(before);
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/focus'), expect.objectContaining({ method: 'PUT', cache: 'no-store', body: JSON.stringify({ role: view.report.roles.find(r => r.template.roleId === 'mobile')!.template }) }));
  expect(vi.mocked(fetch).mock.calls.every(([, options]) => options?.method !== 'POST')).toBe(true);
});
it('drops a late role preference response after account switch without restoring old private caches', async () => {
  const fallback = vi.mocked(fetch).getMockImplementation()!; let finish!: (value: Response) => void;
  vi.mocked(fetch).mockImplementation((input, options) => options?.method === 'PUT' ? new Promise(resolve => { finish = resolve; }) : fallback(input, options));
  const mounted = render(focused()); await waitFor(() => expect(screen.getByRole('combobox')).toBeEnabled()); await userEvent.selectOptions(screen.getByRole('combobox'), 'mobile');
  vi.mocked(useAuth).mockReturnValue({ user: null, isLoading: false, refresh: vi.fn() }); mounted.rerender(focused());
  await act(async () => finish(success({ ...focus, role: view.report.roles.find(r => r.template.roleId === 'mobile')!.template })));
  expect(client.getQueriesData({ queryKey: ['readiness', view.report.ownerUserId] })).toEqual([]); expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
});
it('keeps the same rescan key after an uncertain network failure and explains the unchanged result', async () => {
  const fallback = vi.mocked(fetch).getMockImplementation()!; let fail = true;
  vi.mocked(fetch).mockImplementation((input, options) => { if (options?.method === 'POST' && fail) { fail = false; return Promise.reject(new Error('Connection lost')); } return fallback(input, options); });
  render(wrap(<RescanPanel actor={view.report.ownerUserId} view={view} />)); const button = await screen.findByRole('button', { name: 'Rescan selected repositories' }); await waitFor(() => expect(button).toBeEnabled());
  await userEvent.click(button); await screen.findByText(/rescan could not be confirmed/); await userEvent.click(button); await screen.findByText(/Nothing relevant changed/);
  const calls = vi.mocked(fetch).mock.calls.filter(([, options]) => options?.method === 'POST'); expect(calls).toHaveLength(2); expect(calls[0][1]!.body).toBe(calls[1][1]!.body);
  expect(JSON.parse(calls[0][1]!.body as string).repositoryIds).toEqual([view.report.snapshots[0].repositoryId]); expect(navState.push).not.toHaveBeenCalled(); expect(screen.queryByText(/PRIVATE_NAME_SENTINEL/)).not.toBeInTheDocument();
});
it('deduplicates rapid rescan submission and ignores a late response after unmount', async () => {
  const fallback = vi.mocked(fetch).getMockImplementation()!; let finish!: (value: Response) => void;
  vi.mocked(fetch).mockImplementation((input, options) => options?.method === 'POST' ? new Promise(resolve => { finish = resolve; }) : fallback(input, options));
  const mounted = render(wrap(<RescanPanel actor={view.report.ownerUserId} view={view} />)); const button = await screen.findByRole('button', { name: 'Rescan selected repositories' }); await waitFor(() => expect(button).toBeEnabled());
  await userEvent.dblClick(button); expect(vi.mocked(fetch).mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1); mounted.unmount();
  await act(async () => finish(success({ state: 'unchanged', reportId: view.report.reportId, charge: 'none' }))); expect(navState.push).not.toHaveBeenCalled();
});
it('shows separate strength/confidence/unknown values, accessible filters, paging and immutable evidence links', async () => {
  const { container } = render(wrap(<ReportComparison baselineId={view.report.reportId} targetId={fixtureId(70)} />)); await screen.findByRole('heading', { name: 'Changes in your project evidence' });
  expect(screen.getByText('Strength 55% → 65% · +10 percentage points')).toBeInTheDocument(); expect(screen.getByText('Confidence 55% → 55% · 0 percentage points')).toBeInTheDocument(); expect(screen.getAllByText(/Coverage Unknown → Unknown/)).toHaveLength(5);
  expect(screen.getByRole('link', { name: 'Inspect target evidence' })).toHaveAttribute('href', `/readiness/reports/${fixtureId(70)}?evidence=${view.report.evidence[0].evidenceId}`);
  await userEvent.click(screen.getByRole('button', { name: 'More changes' })); await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining('offset=30'), expect.anything())); await screen.findByRole('combobox', { name: 'Evidence change' });
  await userEvent.selectOptions(screen.getByLabelText('Evidence change'), 'gained'); await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/offset=0.*change=gained/), expect.anything())); await screen.findByRole('heading', { name: 'Changes in your project evidence' });
  expect(await axe(container, { rules: { 'color-contrast': { enabled: false } } })).toHaveNoViolations();
});
it.each(['foreign pair', 'raw field'])('fails closed on a %s comparison without displaying private server content', async kind => {
  const data = comparison(); if (kind === 'foreign pair') data.target.reportId = fixtureId(99);
  vi.mocked(fetch).mockResolvedValue(success(kind === 'raw field' ? { ...data, rawSource: 'PRIVATE_SOURCE_SENTINEL' } : data));
  render(wrap(<ReportComparison baselineId={view.report.reportId} targetId={fixtureId(70)} />)); await screen.findByRole('heading', { name: 'Comparison unavailable' });
  expect(screen.queryByText('PRIVATE_SOURCE_SENTINEL')).not.toBeInTheDocument(); expect(screen.queryByRole('heading', { name: 'Changes in your project evidence' })).not.toBeInTheDocument();
});

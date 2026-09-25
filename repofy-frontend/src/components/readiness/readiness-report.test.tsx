import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { axe } from 'vitest-axe';
import { useAuth } from '@/components/providers/auth-provider';
import { readinessView, fixtureId } from '@/__tests__/fixtures/readiness-view';
import { ReadinessReport } from './readiness-report';
import { ReadinessHistory } from './report-history';
import { EvidenceCard } from './evidence-explorer';
import { DeleteAnalysis } from './report-shared';
vi.mock('@/components/providers/auth-provider', () => ({ useAuth: vi.fn() }));
let view: ReturnType<typeof readinessView>, client: QueryClient;
let response: unknown, status: number;
const success = (data: unknown) => Response.json({ success: true, data });
function wrap(node: React.ReactNode) { return <QueryClientProvider client={client}>{node}</QueryClientProvider>; }
beforeEach(() => {
  view = readinessView(); response = view; status = 200;
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  vi.mocked(useAuth).mockReturnValue({ user: { id: view.report.ownerUserId, email: 'fixture@example.test' }, isLoading: false, refresh: vi.fn() });
  vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
    const path = String(input);
    if (path.endsWith('/events')) return success({ recorded: true });
    if (path.includes('/evidence?')) return success({ items: [{ evidence: view.report.evidence[0], access: 'active', support: view.aggregation!.capabilities[0].support }], nextEvidenceId: null });
    return Response.json(status === 200 ? { success: true, data: response } : { success: false, error: 'PRIVATE_ERROR_SENTINEL' }, { status });
  });
});
it('renders separate strength/confidence, all role views, unknown weight and observed/unknown scope without a fake overall score', async () => {
  render(wrap(<ReadinessReport reportId={view.report.reportId} />)); await screen.findByRole('heading', { name: 'Your project evidence' });
  expect(screen.getByText('65% · strong')).toBeInTheDocument(); expect(screen.getAllByText('55% · low')).toHaveLength(2);
  expect(screen.getByText('Unavailable', { selector: 'dd' })).toBeVisible(); expect(screen.getByText('95%')).toBeInTheDocument();
  expect(screen.getByText(/This analyzer cannot reach the confidence/)).toBeVisible();
  const recorded = screen.getByText(/Limited calculation: 3.25%/);
  expect(recorded).not.toBeVisible();
  await userEvent.click(screen.getByText('Recorded rubric calculation for backend')); expect(recorded).toBeVisible();
  expect(screen.getByText('Unknown · Not assessable', { selector: 'dd' })).toBeInTheDocument(); expect(screen.getByText('Not observed', { selector: 'dd' })).toBeInTheDocument();
  for (const role of view.report.roles) expect(screen.getByRole('heading', { name: role.template.roleId })).toBeInTheDocument();
  expect(screen.queryByText(/overall score/i)).not.toBeInTheDocument();
  await userEvent.click(screen.getByText('Calculation and scope for Testing')); expect(screen.getByText(/Base strength 65%/)).toBeVisible();
});
it('opens a positive claim in its own report, focuses evidence and returns to the originating button', async () => {
  render(wrap(<ReadinessReport reportId={view.report.reportId} />)); await screen.findByRole('heading', { name: 'Your project evidence' });
  const button = screen.getAllByRole('button', { name: 'Supporting evidence 1' })[0]; await userEvent.click(button);
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Evidence explorer' })).toHaveFocus());
  await screen.findByText('1 observations on this page.');
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining(`/readiness-reports/${view.report.reportId}/evidence?evidenceId=${view.report.evidence[0].evidenceId}`), expect.objectContaining({ cache: 'no-store' }));
  await userEvent.selectOptions(screen.getByLabelText('Role', { exact: true }), 'backend'); await userEvent.selectOptions(screen.getByLabelText('Role requirement'), 'testing');
  await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining('requirementId=testing'), expect.anything()));
  await userEvent.click(screen.getByRole('button', { name: 'Close evidence and return' })); expect(button).toHaveFocus();
});
it('expands future improvements without generating text and sends only a closed event', async () => {
  render(wrap(<ReadinessReport reportId={view.report.reportId} />)); await screen.findByRole('heading', { name: 'Your project evidence' });
  await userEvent.click(screen.getByText('Plan and acceptance criteria')); expect(screen.getByText(view.report.improvements[0].acceptanceCriteria[0])).toBeVisible();
  await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/events'), expect.objectContaining({ body: JSON.stringify({ event: 'improvement_opened', objectId: view.report.improvements[0].improvementId }) })));
  await userEvent.selectOptions(screen.getByLabelText('Filter improvements by role'), 'mobile'); expect(screen.getByText('No improvement proposals match these filters.')).toBeInTheDocument();
});
it('distinguishes identical improvement templates and links to the specific evidence or unknown scope', async () => {
  const original = view.report.improvements[0], gap = view.report.gaps[0];
  view.report.improvements.push({ ...structuredClone(original), improvementId: fixtureId(70) as never,
    capabilityIds: ['mobile'], gapIds: [fixtureId(71) as never] });
  view.report.gaps.push({ ...structuredClone(gap), gapId: fixtureId(71) as never, capabilityId: 'mobile', state: 'not_assessable' });
  view.report.improvements.push({ ...structuredClone(original), improvementId: fixtureId(72) as never,
    capabilityIds: ['api'], gapIds: [fixtureId(73) as never] });
  view.report.gaps.push({ ...structuredClone(gap), gapId: fixtureId(73) as never, capabilityId: 'api', state: 'not_observed' });
  render(wrap(<ReadinessReport reportId={view.report.reportId} />)); await screen.findByRole('heading', { name: 'Your project evidence' });
  const testing = screen.getByRole('heading', { name: `${original.title}: Testing` }).closest('li')!;
  const mobile = screen.getByRole('heading', { name: `${original.title}: Mobile` }).closest('li')!;
  expect(within(testing).getByText('Testing · Limited evidence')).toBeVisible();
  expect(within(mobile).getByText('Mobile · Unknown, not assessable')).toBeVisible();
  expect(within(mobile).getByText('Relevant roles: backend')).toBeVisible();
  expect(within(mobile).queryByRole('button', { name: 'Inspect evidence for Mobile' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Inspect evidence for Api' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Review scope for Api' })).toBeVisible();
  await userEvent.click(within(mobile).getByRole('link', { name: 'Review scope for Mobile' }));
  expect(document.getElementById('capability-mobile')).toHaveFocus();
  expect(document.getElementById('capability-scope-mobile')).toHaveAttribute('open');
  const button = within(testing).getByRole('button', { name: 'Inspect evidence for Testing' });
  await userEvent.click(button);
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Evidence explorer' })).toHaveFocus());
  await screen.findByText('1 observations on this page.');
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('evidence?capabilityId=testing'), expect.anything());
  expect(screen.getByRole('button', { name: 'Inspect permitted location' })).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Close evidence and return' })); expect(button).toHaveFocus();
});
it('fails closed on malformed responses, foreign owners, and server errors without rendering their raw text', async () => {
  response = { ...view, report: { ...view.report, rawSource: 'PRIVATE_SOURCE_SENTINEL' } };
  const rendered = render(wrap(<ReadinessReport reportId={view.report.reportId} />)); expect(await screen.findByRole('alert')).toHaveTextContent('valid saved report');
  expect(screen.queryByText(/PRIVATE_SOURCE/)).not.toBeInTheDocument(); rendered.unmount();
  response = { ...view, report: { ...view.report, ownerUserId: fixtureId(90) }, aggregation: null };
  const second = render(wrap(<ReadinessReport reportId={view.report.reportId} />)); await screen.findByRole('alert'); expect(screen.queryByText('Your project evidence')).not.toBeInTheDocument(); second.unmount();
  status = 404; render(wrap(<ReadinessReport reportId={view.report.reportId} />)); expect(await screen.findByRole('alert')).toHaveTextContent('belong to another account'); expect(screen.queryByText('PRIVATE_ERROR_SENTINEL')).not.toBeInTheDocument();
});
it('clears account-scoped caches and rendered report on account switch and logout', async () => {
  const rendered = render(wrap(<ReadinessReport reportId={view.report.reportId} />)); await screen.findByRole('heading', { name: 'Your project evidence' });
  vi.mocked(useAuth).mockReturnValue({ user: { id: fixtureId(90), email: 'other@example.test' }, isLoading: false, refresh: vi.fn() });
  rendered.rerender(wrap(<ReadinessReport reportId={view.report.reportId} />)); expect(screen.queryByText('Your project evidence')).not.toBeInTheDocument(); await screen.findByRole('alert');
  expect(client.getQueriesData({ queryKey: ['readiness', view.report.ownerUserId] })).toEqual([]);
  vi.mocked(useAuth).mockReturnValue({ user: null, isLoading: false, refresh: vi.fn() }); rendered.rerender(wrap(<ReadinessReport reportId={view.report.reportId} />)); expect(screen.getByText('Sign in to view your private readiness reports.')).toBeVisible();
});
it('uses safe rendered text for long labels and arbitrary markup and has no automated accessibility violations', async () => {
  view.capabilities[0].label = 'Long ' + 'capability '.repeat(20); view.report.claims[0].text = '<img src=x onerror=alert(1)> bounded observation';
  const cap = view.report.capabilityGroups[0].capabilities[0]; if (cap.state === 'assessed') cap.reasoning.text = view.report.claims[0].text;
  const { container } = render(wrap(<ReadinessReport reportId={view.report.reportId} />)); await screen.findByRole('heading', { name: 'Your project evidence' });
  expect(screen.getAllByText(/<img src=x/).length).toBeGreaterThan(0); expect(container.querySelector('img')).toBeNull();
  expect(await axe(container, { rules: { 'color-contrast': { enabled: false } } })).toHaveNoViolations(); // Contrast runs in real Chromium.
});
it('requires current permission for locations, rejects unsafe links and clears private names on blur', async () => {
  response = { state: 'available', evidenceId: view.report.evidence[0].evidenceId, commitSha: 'a'.repeat(40), label: 'tests/fixture.ts', repositoryLabel: 'fixture/private-project', visibility: 'private' };
  render(wrap(<EvidenceCard reportId={view.report.reportId} repositoryLabel="Repository 1" item={{ evidence: view.report.evidence[0], access: 'active', support: [] }} />));
  expect(screen.queryByText(/fixture\/private-project/)).not.toBeInTheDocument(); await userEvent.click(screen.getByRole('button', { name: 'Inspect permitted location' })); await screen.findByText(/fixture\/private-project/);
  fireEvent.blur(window); expect(screen.queryByText(/fixture\/private-project/)).not.toBeInTheDocument();
  response = { ...(response as object), visibility: 'public', url: 'javascript:alert(1)' }; await userEvent.click(screen.getByRole('button', { name: 'Inspect permitted location' })); await screen.findByText(/could not be verified/); expect(screen.queryByRole('link')).not.toBeInTheDocument();
  response = { state: 'access_revoked', evidenceId: view.report.evidence[0].evidenceId }; await userEvent.click(screen.getByRole('button', { name: 'Inspect permitted location' })); await screen.findByText(/Repository access changed/);
});
it('ignores a late location response after the page loses focus', async () => {
  let resolve!: (response: Response) => void; vi.mocked(fetch).mockImplementation(() => new Promise(r => { resolve = r; }));
  render(wrap(<EvidenceCard reportId={view.report.reportId} repositoryLabel="Repository 1" item={{ evidence: view.report.evidence[0], access: 'active', support: [] }} />));
  await userEvent.click(screen.getByRole('button', { name: 'Inspect permitted location' })); fireEvent.blur(window);
  await act(async () => resolve(success({ state: 'available', evidenceId: view.report.evidence[0].evidenceId, commitSha: 'a'.repeat(40), label: 'private/file.ts', repositoryLabel: 'private/repository', visibility: 'private' })));
  expect(screen.queryByText(/private\/repository/)).not.toBeInTheDocument();
});
it('shows empty history, bounded pages and a recoverable history error', async () => {
  response = { items: [], nextReportId: null }; render(wrap(<ReadinessHistory />)); await screen.findByText('No saved reports yet'); expect(screen.getByRole('button', { name: 'More reports' })).toBeDisabled();
  response = { items: [{ reportId: view.report.reportId, runId: view.report.analysisRunId, jobId: view.report.jobId, createdAt: view.report.createdAt, repositoryCount: 1 }], nextReportId: fixtureId(66) };
  await act(async () => { await client.invalidateQueries(); }); await screen.findByText(/Report from/); await userEvent.click(screen.getByRole('button', { name: 'More reports' }));
  await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining('afterReportId='), expect.anything()));
  status = 503; await act(async () => { await client.invalidateQueries(); }); await screen.findByRole('alert');
});
it('confirms deletion with keyboard focus and retains report on a failed request', async () => {
  response = { deleted: true }; const onDeleted = vi.fn(); render(wrap(<DeleteAnalysis id={view.report.reportId} onDeleted={onDeleted} />));
  const user = userEvent.setup(); await user.click(screen.getByRole('button', { name: 'Delete analysis' })); await screen.findByRole('dialog');
  await user.keyboard('{Escape}'); await waitFor(() => expect(screen.getByRole('button', { name: 'Delete analysis' })).toHaveFocus());
  await user.click(screen.getByRole('button', { name: 'Delete analysis' })); status = 503; await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete permanently' })); await screen.findByRole('alert'); expect(onDeleted).not.toHaveBeenCalled();
  status = 200; await user.click(screen.getByRole('button', { name: 'Delete permanently' })); await waitFor(() => expect(onDeleted).toHaveBeenCalledOnce());
});

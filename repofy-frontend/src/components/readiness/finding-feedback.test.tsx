import { beforeEach, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { axe } from 'vitest-axe';
import type { FindingFeedbackResponse, SnapshotProvenance } from '@repofy/contracts';
import { fixtureId, readinessView } from '@/__tests__/fixtures/readiness-view';
import { FindingFeedbackControl } from './finding-feedback';
import { ProvenancePanel } from './provenance-panel';

let client: QueryClient, response: FindingFeedbackResponse;
const actor = fixtureId(1), reportId = fixtureId(2), finding = { kind: 'capability' as const, id: 'testing' };
const key = ['readiness', actor, reportId, 'feedback', finding.kind, finding.id];
const success = (data: unknown) => Response.json({ success: true, data });
const posts = () => vi.mocked(fetch).mock.calls.filter(([url, opts]) => String(url).endsWith('/feedback') && opts?.method === 'POST');
function tree(owner = actor) { return <QueryClientProvider client={client}><FindingFeedbackControl actor={owner} reportId={reportId} finding={finding} label="Testing" /></QueryClientProvider>; }
async function open() { await userEvent.click(screen.getByText('Feedback on Testing')); await screen.findByRole('radio', { name: 'Accurate' }); }
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  response = { feedback: null, writable: true };
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, opts) => {
    if (opts?.method === 'POST') {
      const body = JSON.parse(opts.body as string);
      if (body.expectedRevision !== (response.feedback?.revision ?? 0)) return Response.json({ success: false }, { status: 409 });
      response = { writable: true, feedback: { id: fixtureId(3), reportId, finding, classification: body.classification, comment: body.comment, revision: body.expectedRevision + 1, updatedAt: '2026-09-20T00:00:00Z', disposition: 'open' } };
    }
    return success(response);
  });
});
it('loads on demand, persists all four choices and an edit, escapes comments, and exposes accessible controls', async () => {
  const { container } = render(tree()); expect(fetch).not.toHaveBeenCalled(); await open();
  await userEvent.click(screen.getByRole('radio', { name: 'Inaccurate' }));
  await userEvent.type(screen.getByLabelText('Optional comment'), '<img src=x onerror=alert(1)>');
  await userEvent.click(screen.getByRole('button', { name: 'Save finding feedback' })); await screen.findByText(/Feedback saved for this finding version/);
  expect(response.feedback).toMatchObject({ classification: 'inaccurate', revision: 1 }); expect(container.querySelector('img')).toBeNull();
  for (const name of ['Unclear', 'Irrelevant', 'Accurate']) {
    await userEvent.click(screen.getByRole('radio', { name })); await userEvent.click(screen.getByRole('button', { name: 'Update finding feedback' }));
    await waitFor(() => expect(response.feedback?.classification).toBe(name.toLowerCase()));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Update finding feedback' })).toBeEnabled());
  }
  expect(response.feedback?.revision).toBe(4); expect(screen.getByLabelText('Optional comment')).toHaveAttribute('maxlength', '1000');
  expect(await axe(container, { rules: { 'color-contrast': { enabled: false } } })).toHaveNoViolations();
});
it('reuses the exact request after an uncertain offline failure and auth refresh', async () => {
  const fallback = vi.mocked(fetch).getMockImplementation()!; let phase = 0;
  vi.mocked(fetch).mockImplementation((url, opts) => {
    if (String(url).endsWith('/auth/refresh')) return Promise.resolve(success({}));
    if (opts?.method === 'POST' && phase++ === 0) return Promise.reject(new Error('Offline PRIVATE_ERROR_SENTINEL'));
    if (opts?.method === 'POST' && phase === 2) return Promise.resolve(Response.json({ success: false }, { status: 401 }));
    return fallback(url, opts);
  });
  render(tree()); await open(); await userEvent.click(screen.getByRole('button', { name: 'Save finding feedback' }));
  await screen.findByText(/Feedback could not be confirmed/); expect(screen.queryByText(/PRIVATE_ERROR/)).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Save finding feedback' })); await screen.findByText(/Feedback saved/);
  expect(posts()).toHaveLength(3); expect(new Set(posts().map(([, opts]) => opts!.body)).size).toBe(1); expect(response.feedback?.revision).toBe(1);
});
it('fences a dirty draft against another tab even when the cached response refreshes', async () => {
  render(tree()); await open(); await userEvent.type(screen.getByLabelText('Optional comment'), 'My draft');
  response = { writable: true, feedback: { id: fixtureId(3), reportId, finding, classification: 'unclear', comment: 'Other tab', revision: 1, updatedAt: '2026-09-20T00:00:00Z', disposition: 'open' } };
  await act(async () => { client.setQueryData(key, response); });
  const update = await screen.findByRole('button', { name: 'Update finding feedback' });
  expect(screen.getByLabelText('Optional comment')).toHaveValue('My draft'); await userEvent.click(update);
  await screen.findByText(/Another response was saved/); expect(JSON.parse(posts()[0][1]!.body as string).expectedRevision).toBe(0);
  await userEvent.click(screen.getByRole('button', { name: 'Reload current response' }));
  await waitFor(() => expect(screen.getByLabelText('Optional comment')).toHaveValue('Other tab'));
  await userEvent.click(screen.getByRole('radio', { name: 'Irrelevant' })); await userEvent.click(screen.getByRole('button', { name: 'Update finding feedback' }));
  await screen.findByText(/Feedback saved/); expect(response.feedback?.revision).toBe(2);
});
it('deduplicates rapid saves and ignores late acknowledgements after owner change', async () => {
  const fallback = vi.mocked(fetch).getMockImplementation()!; let finish!: (r: Response) => void;
  vi.mocked(fetch).mockImplementation((url, opts) => opts?.method === 'POST' ? new Promise(resolve => { finish = resolve; }) : fallback(url, opts));
  const mounted = render(tree()); await open(); await userEvent.dblClick(screen.getByRole('button', { name: 'Save finding feedback' })); expect(posts()).toHaveLength(1);
  mounted.rerender(tree(fixtureId(50))); client.removeQueries({ queryKey: ['readiness', actor] });
  await act(async () => finish(success({ writable: true, feedback: { id: fixtureId(3), reportId, finding, classification: 'accurate', comment: 'PRIVATE_LATE_SENTINEL', revision: 1, updatedAt: '2026-09-20T00:00:00Z', disposition: 'open' } })));
  expect(screen.queryByText(/Feedback saved/)).not.toBeInTheDocument(); expect(client.getQueryData(key)).toBeUndefined(); expect(screen.queryByDisplayValue('PRIVATE_LATE_SENTINEL')).not.toBeInTheDocument();
});
it('fails closed on foreign findings and keeps saved feedback readable while writes are off', async () => {
  response = { writable: false, feedback: { id: fixtureId(3), reportId, finding, classification: 'unclear', comment: '', revision: 1, updatedAt: '2026-09-20T00:00:00Z', disposition: 'needs_reproduction' } };
  const mounted = render(tree()); await userEvent.click(screen.getByText('Feedback on Testing')); await screen.findByText(/saved response remains readable/);
  expect(screen.getByText(/Current response: unclear/i)).toHaveTextContent('needs reproduction'); expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  mounted.unmount(); client.clear(); response.feedback!.finding = { kind: 'capability', id: 'foreign' }; render(tree()); await userEvent.click(screen.getByText('Feedback on Testing'));
  await screen.findByRole('alert'); expect(screen.queryByText(/Current response/)).not.toBeInTheDocument();
});
it('shows bounded provenance explanations without a fabricated score and preserves older reports', () => {
  const view = readinessView(), before = JSON.stringify(view); const mounted = render(<ProvenancePanel view={view} />);
  expect(screen.getByText(/older analysis did not retain/)).toBeInTheDocument(); expect(JSON.stringify(view)).toBe(before); mounted.unmount();
  const snapshot = view.report.snapshots[0];
  const provenance: SnapshotProvenance = { snapshotId: snapshot.snapshotId, repositoryId: snapshot.repositoryId, commitSha: snapshot.commitSha,
    detector: { id: 'provenance_context', version: '1.0.0' }, observedAt: '2026-09-20T00:00:00Z', provider: { state: 'available', fork: true, templateOrigin: 'unknown', relationship: 'current_repository_context' },
    history: { state: 'not_requested', records: 0, linkedToConnected: 0, linkedToOthers: 0, unlinked: 0, headIsOnlyRoot: false, relationship: 'pinned_head_and_bounded_ancestors' },
    files: { total: 100, generatedExcluded: 2, generatedMarked: 1, vendorExcluded: 3 }, signals: ['provider_fork','generated_files','history_unavailable'], limitations: ['not_authorship'],
    contribution: { state: 'unknown', confidence: null, strengthModifier: null, confidenceModifier: null, basis: 'context_only_uncalibrated' } };
  view.aggregation!.provenance = { policy: provenance.detector, snapshots: [provenance] }; render(<ProvenancePanel view={view} />);
  expect(screen.getByText(/Contribution confidence: Unknown/)).toBeInTheDocument(); expect(screen.getByText(/Original work may also be present/)).toBeInTheDocument();
  expect(screen.getByText(/not AI-code detection/)).toBeInTheDocument(); expect(screen.getByText(/Template origin unknown/)).toBeInTheDocument(); expect(screen.queryByText(/Contribution confidence: 0/)).not.toBeInTheDocument();
});

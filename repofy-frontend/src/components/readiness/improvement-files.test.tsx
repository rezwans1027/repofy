import { beforeEach, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { improvementEvidenceReferences, ReportViewSchema } from '@repofy/contracts';
import { readinessView, fixtureId } from '@/__tests__/fixtures/readiness-view';
import { Improvements } from './report-assessments';

let view: ReturnType<typeof readinessView>;
const success = (data: unknown) => Response.json({ success: true, data });
function location(visibility: 'public' | 'private' = 'private') {
  const evidence = view.report.evidence[0];
  return { state: 'available', evidenceId: evidence.evidenceId, commitSha: evidence.commitSha,
    label: 'src/relevant.test.ts', repositoryLabel: 'fixture/project', visibility, lines: { start: 2, end: 4 },
    ...(visibility === 'public' ? { url: `https://github.com/fixture/project/blob/${evidence.commitSha}/src/relevant.test.ts#L2-L4` } : {}) };
}
beforeEach(() => {
  view = readinessView();
  view.report.improvements[0].repositoryIds = [view.report.snapshots[0].repositoryId];
  view.improvementEvidence = improvementEvidenceReferences(view.report, view.aggregation);
  expect(view.improvementEvidence).toHaveLength(1);
  ReportViewSchema.parse(view);
  vi.spyOn(globalThis, 'fetch').mockImplementation(async input => String(input).endsWith('/events') ? success({ recorded: true }) : success(location()));
});
async function open() {
  render(<Improvements view={view} openEvidence={vi.fn()} />);
  await userEvent.click(screen.getByText('Plan and acceptance criteria'));
}
it('offers a relevant existing file in the plan and resolves its private path only on request', async () => {
  await open();
  expect(screen.getByText(/an exact edit location has not been verified/)).toBeVisible();
  expect(screen.queryByText('src/relevant.test.ts')).not.toBeInTheDocument();
  expect(vi.mocked(fetch).mock.calls.some(([path]) => String(path).endsWith('/location'))).toBe(false);
  await userEvent.click(screen.getByRole('button', { name: /Inspect relevant file/ }));
  expect(await screen.findByText('src/relevant.test.ts')).toBeVisible();
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining(`/readiness-reports/${view.report.reportId}/evidence/${view.report.evidence[0].evidenceId}/location`), expect.objectContaining({ method: 'POST', cache: 'no-store' }));
  expect(screen.queryByRole('link', { name: 'Open exact commit on GitHub' })).not.toBeInTheDocument();
  fireEvent.blur(window);
  expect(screen.queryByText('src/relevant.test.ts')).not.toBeInTheDocument();
});
it('allows an exact commit link only for evidence still verified public', async () => {
  view.repositories[0].visibility = 'public'; view.report.snapshots[0].repositoryVisibility = 'public'; view.report.evidence[0].repositoryVisibility = 'public';
  vi.mocked(fetch).mockImplementation(async input => String(input).endsWith('/events') ? success({ recorded: true }) : success(location('public')));
  await open(); await userEvent.click(screen.getByRole('button', { name: /Inspect relevant file/ }));
  expect(await screen.findByRole('link', { name: 'Open exact commit on GitHub' })).toHaveAttribute('href', location('public').url);
});
it('shows revoked access without offering or fetching the private path', async () => {
  view.repositories[0].access = 'revoked';
  await open(); expect(screen.getByText(/access revoked; file location hidden/)).toBeVisible();
  expect(screen.queryByRole('button', { name: /Inspect relevant file/ })).not.toBeInTheDocument();
  expect(vi.mocked(fetch).mock.calls.some(([path]) => String(path).endsWith('/location'))).toBe(false);
});
it('does not invent a file target when relevant supporting evidence is absent', async () => {
  view.report.improvements[0].repositoryIds = [];
  view.improvementEvidence = improvementEvidenceReferences(view.report, view.aggregation);
  await open(); expect(screen.getByText(/No relevant file reference was established/)).toBeVisible();
  expect(screen.queryByRole('button', { name: /Inspect relevant file/ })).not.toBeInTheDocument();
});
it.each(['access_revoked', 'not_retained', 'unavailable', 'foreign'])('hides paths when the live location response is %s', async state => {
  vi.mocked(fetch).mockImplementation(async input => String(input).endsWith('/events') ? success({ recorded: true })
    : success(state === 'foreign' ? { ...location(), evidenceId: fixtureId(99) } : { state, evidenceId: view.report.evidence[0].evidenceId }));
  await open(); await userEvent.click(screen.getByRole('button', { name: /Inspect relevant file/ }));
  await screen.findByRole('status'); expect(screen.queryByText('src/relevant.test.ts')).not.toBeInTheDocument();
});
it('discards a permission response that finishes after the page loses focus', async () => {
  let finish!: (response: Response) => void;
  vi.mocked(fetch).mockImplementation(async input => String(input).endsWith('/events') ? success({ recorded: true }) : new Promise(resolve => { finish = resolve; }));
  await open(); await userEvent.click(screen.getByRole('button', { name: /Inspect relevant file/ }));
  fireEvent.blur(window);
  await act(async () => finish(success(location())));
  expect(screen.queryByText('src/relevant.test.ts')).not.toBeInTheDocument();
});

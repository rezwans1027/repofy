import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
const backend = 'http://127.0.0.1:3191';
test.describe.configure({ mode: 'serial' });

const installAxe = async (page: import('@playwright/test').Page) => page.evaluate(source => {
  const script = document.createElement('script'); script.nonce = document.querySelector<HTMLScriptElement>('script[nonce]')?.nonce ?? '';
  script.textContent = source; document.head.appendChild(script);
}, readFileSync(resolve('node_modules/axe-core/axe.min.js'), 'utf8'));

test('authorized multi-repository workflow → real worker report → keyboard evidence → privacy, rollback, account isolation and deletion', async ({ page, context, request }) => {
  const session = await (await request.get(`${backend}/__test/session`)).json();
  await context.addCookies([{ name: 'access_token', value: session.token, domain: '127.0.0.1', path: '/' }]);
  const browserErrors: string[] = []; page.on('console', m => { if (m.type() === 'error') browserErrors.push(m.text()); }); page.on('pageerror', e => browserErrors.push(e.message));
  await page.goto('/readiness'); await expect(page.getByText('No saved reports yet')).toBeVisible();
  await page.getByRole('link', { name: 'Select repositories', exact: true }).click();
  await page.getByLabel('GitHub identity').selectOption({ label: 'fixture-one — connected' });
  await page.getByLabel('Installation', { exact: true }).selectOption({ label: 'fixture-org — Organization, active' });
  for (const id of ['300', '301']) await page.getByRole('checkbox', { name: new RegExp(`synthetic-private-${id}`) }).check();
  await page.getByRole('checkbox', { name: /I own or am authorized/ }).check(); await page.getByRole('button', { name: 'Save selection' }).click();
  await expect(page.getByRole('button', { name: 'Start Analysis' })).toBeEnabled();
  // Expire only the browser token after mounting. The shared client refreshes and
  // replays the same idempotency key, including a rapid second click.
  await context.addCookies([{ name: 'access_token', value: 'expired-fixture', domain: '127.0.0.1', path: '/' }]);
  await page.getByRole('button', { name: 'Start Analysis' }).dblclick();
  await expect(page).toHaveURL(/\/readiness\/jobs\/[a-f0-9-]+/);
  await page.reload(); await expect(page.getByRole('link', { name: 'View saved report' })).toBeVisible({ timeout: 30000 });
  await page.getByRole('link', { name: 'View saved report' }).click();
  await expect(page.getByRole('heading', { name: 'Your project evidence' })).toBeVisible();
  const reportUrl = page.url(), reportId = reportUrl.split('/').at(-1)!;
  const data = (await (await request.get(`${backend}/api/v1/readiness-reports/${reportId}/view`, { headers: { Authorization: `Bearer ${session.token}` } })).json()).data;
  expect(data.report.snapshots).toHaveLength(2); expect(data.report.roles).toHaveLength(5);
  expect(data.roleAvailability).toHaveLength(5);
  expect(data.roleAvailability.every((r: { state: string }) => r.state !== 'available')).toBe(true);
  const unavailable = data.roleAvailability.filter((r: { state: string }) => r.state === 'unavailable');
  expect(unavailable.length).toBeGreaterThan(0);
  await expect(page.locator('#roles').getByText('Unavailable', { exact: true })).toHaveCount(unavailable.length);
  await expect(page.getByText(/^Limited calculation:/).first()).not.toBeVisible();
  for (const snapshot of data.report.snapshots) {
    const evidence = (await (await request.get(`${backend}/api/v1/readiness-reports/${reportId}/evidence?repositoryId=${snapshot.repositoryId}`, { headers: { Authorization: `Bearer ${session.token}` } })).json()).data;
    expect(evidence.items.length).toBeGreaterThan(0);
    expect(evidence.items.every((item: { evidence: { snapshotId: string } }) => item.evidence.snapshotId === snapshot.snapshotId)).toBe(true);
  }
  await expect(page.getByRole('heading', { name: 'Repository 1', exact: true })).toBeVisible(); await expect(page.getByRole('heading', { name: 'Repository 2', exact: true })).toBeVisible();
  expect(await page.content()).not.toMatch(/RAW_SOURCE_SENTINEL|PRIVATE_CUSTOMER|function retry/);
  const head = await page.locator('head').innerHTML(); expect(head).not.toMatch(/synthetic-private|fixture-org|PRIVATE_CUSTOMER/); expect(head).toContain('noindex');
  const state = await (await request.get(`${backend}/__test/state`)).json(); expect(state.modelCalls).toBe(1); expect(state.jobs).toHaveLength(1); expect(state.workspaceFiles).toBe(0);
  // Keyboard opens a verified claim's exact evidence, moves focus, and returns.
  const citation = page.getByRole('button', { name: 'Supporting evidence 1', exact: true }).first(); await citation.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Evidence explorer' })).toBeFocused();
  await expect(page.getByText('1 observations on this page.')).toBeVisible();
  await page.getByRole('button', { name: 'Close evidence and return' }).click(); await expect(citation).toBeFocused();
  await page.getByText('Plan and acceptance criteria', { exact: true }).first().click(); await expect(page.getByText('Expected evidence gained', { exact: true }).first()).toBeVisible();
  // Repeated templates retain their capability identity; unknown gaps navigate
  // to scope and positive gaps reach the existing permission-checked locator flow.
  const scopeLink = page.locator('#improvements').getByRole('link', { name: /^Review scope for / }).first();
  const scopeTarget = (await scopeLink.getAttribute('href'))!;
  await scopeLink.focus(); await page.keyboard.press('Enter');
  await expect(page.locator(scopeTarget)).toBeFocused();
  await expect(page.locator(scopeTarget.replace('#capability-', '#capability-scope-'))).toHaveAttribute('open', '');
  const improvementEvidence = page.locator('#improvements').getByRole('button', { name: /^Inspect evidence for / }).first();
  await improvementEvidence.click(); await expect(page.getByRole('heading', { name: 'Evidence explorer' })).toBeFocused();
  await expect(page.getByText(/observations on this page/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Inspect permitted location' }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Close evidence and return' }).click(); await expect(improvementEvidence).toBeFocused();
  await page.getByRole('button', { name: 'Browse evidence' }).click(); await page.getByRole('button', { name: 'Clear evidence filters' }).click();
  const publicSnapshot = data.report.snapshots.find((s: { repositoryVisibility: string }) => s.repositoryVisibility === 'public');
  await page.getByLabel('Repository', { exact: true }).selectOption(publicSnapshot.repositoryId);
  await page.getByRole('button', { name: 'Inspect permitted location' }).first().click();
  const publicLink = page.getByRole('link', { name: 'Open exact commit on GitHub' }).first(); await expect(publicLink).toBeVisible(); expect(await publicLink.getAttribute('href')).toContain(`/blob/${publicSnapshot.commitSha}/`);
  await request.post(`${backend}/__test/private`, { data: { repositoryId: publicSnapshot.repositoryId } }); await page.getByRole('button', { name: 'Inspect permitted location' }).first().click();
  await expect(publicLink).toHaveCount(0); await expect(page.getByText('Verified private evidence. Location visible only after your permission check.')).toBeVisible();
  // Disabling intake never disables saved reads and makes no extra model calls.
  await request.post(`${backend}/__test/controls`, { data: { enabled: false } }); const response = await page.reload(); expect(response!.headers()['cache-control']).toContain('no-store');
  await expect(page.getByRole('heading', { name: 'Your project evidence' })).toBeVisible(); expect((await (await request.get(`${backend}/__test/state`)).json()).modelCalls).toBe(1);
  // All roles retain textual unknown states; native controls are keyboard accessible.
  await page.getByRole('button', { name: 'Browse evidence' }).click(); await expect(page.getByText(/observations on this page/)).toBeVisible();
  await page.evaluate(source => {
    const script = document.createElement('script'); script.nonce = document.querySelector<HTMLScriptElement>('script[nonce]')?.nonce ?? '';
    script.textContent = source; document.head.appendChild(script);
  }, readFileSync(resolve('node_modules/axe-core/axe.min.js'), 'utf8'));
  const violations = await page.evaluate(async () => (await (window as unknown as { axe: { run: (target: string) => Promise<{ violations: unknown[] }> } }).axe.run('#main-content')).violations);
  expect(violations).toEqual([]);
  await page.screenshot({ path: 'test-results/run13-report-desktop.png', fullPage: true });
  await page.getByRole('heading', { name: 'Your project evidence' }).scrollIntoViewIfNeeded(); await page.screenshot({ path: 'test-results/run13-summary-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: 'test-results/run13-report-mobile.png', fullPage: true });
  await page.getByRole('heading', { name: 'Your project evidence' }).scrollIntoViewIfNeeded(); await page.screenshot({ path: 'test-results/run13-summary-mobile.png' });
  const mobileLayout = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: window.innerWidth,
    overflow: Array.from(document.querySelectorAll('main *')).filter(e => e.getBoundingClientRect().right > window.innerWidth)
      .map(e => ({ tag: e.tagName, text: e.textContent?.slice(0, 100), width: e.getBoundingClientRect().width })).slice(0, 10) }));
  expect(mobileLayout.width, JSON.stringify(mobileLayout.overflow)).toBeLessThanOrEqual(mobileLayout.viewport);
  await page.locator('#roles > article').first().screenshot({ path: 'test-results/prd-role-status-mobile.png' });
  await page.locator('#improvements > ol > li').first().screenshot({ path: 'test-results/prd-improvement-mobile.png' });
  expect(await page.evaluate(async () => (await (window as unknown as { axe: { run: (target: string) => Promise<{ violations: unknown[] }> } }).axe.run('#main-content')).violations)).toEqual([]);
  const other = await (await request.get(`${backend}/__test/session?actor=2`)).json();
  for (const suffix of ['', '/view', '/evidence', `/evidence/${data.report.evidence[0].evidenceId}`]) expect((await request.get(`${backend}/api/v1/readiness-reports/${reportId}${suffix}`, { headers: { Authorization: `Bearer ${other.token}` } })).status()).toBe(404);
  await context.addCookies([{ name: 'access_token', value: other.token, domain: '127.0.0.1', path: '/' }]); await page.reload();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('unavailable'); await expect(page.getByRole('heading', { name: 'Your project evidence' })).toHaveCount(0);
  await context.addCookies([{ name: 'access_token', value: session.token, domain: '127.0.0.1', path: '/' }]); await page.reload();
  const selected = (await (await request.get(`${backend}/api/v1/repository-selections`, { headers: { Authorization: `Bearer ${session.token}` } })).json()).data;
  const grant = selected.repositories[0]; await request.post(`${backend}/__test/revoke`, { data: { grantId: grant.grantId } }); await page.reload();
  await expect(page.getByText(/Access revoked; locations hidden/)).toBeVisible();
  const revokedEvidence = (await (await request.get(`${backend}/api/v1/readiness-reports/${reportId}/evidence?repositoryId=${grant.repositoryId}`, { headers: { Authorization: `Bearer ${session.token}` } })).json()).data.items[0].evidence;
  expect((await (await request.post(`${backend}/api/v1/readiness-reports/${reportId}/evidence/${revokedEvidence.evidenceId}/location`, { headers: { Authorization: `Bearer ${session.token}` } })).json()).data.state).toBe('access_revoked');
  // Destructive confirmation has a keyboard focus trap, Escape restores trigger.
  const deleteButton = page.getByRole('button', { name: 'Delete analysis', exact: true }); await deleteButton.click(); await expect(page.getByRole('dialog')).toBeVisible(); await page.keyboard.press('Escape'); await expect(deleteButton).toBeFocused();
  await deleteButton.click(); await page.getByRole('button', { name: 'Delete permanently' }).click(); await expect(page).toHaveURL(/\/readiness$/); await expect(page.getByText('No saved reports yet')).toBeVisible();
  expect((await request.get(`${backend}/api/v1/readiness-reports/${reportId}/view`, { headers: { Authorization: `Bearer ${session.token}` } })).status()).toBe(404);
  expect(browserErrors.join('\n')).not.toMatch(/RAW_SOURCE_SENTINEL|PRIVATE_CUSTOMER|function retry|synthetic-private/);
  const finalState = await (await request.get(`${backend}/__test/state`)).json(); expect(finalState.events.some((e: { action: string }) => e.action === 'improvement_opened')).toBe(true);
});

test('single repository workflow and deletion during an active job leave no stale publication', async ({ page, context, request }) => {
  const session = await (await request.get(`${backend}/__test/session`)).json(); const headers = { Authorization: `Bearer ${session.token}` };
  await context.addCookies([{ name: 'access_token', value: session.token, domain: '127.0.0.1', path: '/' }]);
  await request.post(`${backend}/__test/controls`, { data: { enabled: true, paused: true } });
  const saved = (await (await request.get(`${backend}/api/v1/repository-selections`, { headers })).json()).data;
  for (const item of saved.repositories) await request.delete(`${backend}/api/v1/repository-selections/${item.grantId}`, { headers });
  await page.goto('/readiness/new'); await page.getByLabel('GitHub identity').selectOption({ label: 'fixture-one — connected' });
  await page.getByLabel('Installation', { exact: true }).selectOption({ label: 'fixture-org — Organization, active' });
  await page.getByRole('checkbox', { name: /synthetic-private-301/ }).check(); await page.getByRole('checkbox', { name: /I own or am authorized/ }).check();
  await page.getByRole('button', { name: 'Save selection' }).click(); await expect(page.getByRole('button', { name: 'Start Analysis' })).toBeEnabled();
  await page.getByRole('button', { name: 'Start Analysis' }).click(); await expect(page).toHaveURL(/\/readiness\/jobs\//);
  const jobId = page.url().split('/').at(-1); expect((await (await request.post(`${backend}/__test/claim`)).json()).jobId).toBe(jobId);
  await page.reload(); await expect(page.getByText('Checking repository access')).toBeVisible();
  await page.getByRole('button', { name: 'Delete analysis' }).click(); await page.getByRole('button', { name: 'Delete permanently' }).click();
  await expect(page).toHaveURL(/\/readiness$/); expect((await (await request.post(`${backend}/__test/stale-heartbeat`)).json()).blocked).toBe(true);
  expect((await request.get(`${backend}/api/v1/analyses/${jobId}`, { headers })).status()).toBe(404);
  const before = await (await request.get(`${backend}/__test/state`)).json();
  await request.post(`${backend}/__test/controls`, { data: { paused: false } }); await page.goto('/readiness/new');
  await page.getByRole('button', { name: 'Start Analysis' }).click(); await expect(page.getByRole('link', { name: 'View saved report' })).toBeVisible({ timeout: 30000 });
  await page.getByRole('link', { name: 'View saved report' }).click(); await expect(page.getByRole('heading', { name: 'Your project evidence' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Repository 1', exact: true })).toBeVisible(); await expect(page.getByRole('heading', { name: 'Repository 2', exact: true })).toHaveCount(0);
  const after = await (await request.get(`${backend}/__test/state`)).json(); expect(after.modelCalls).toBe(before.modelCalls + 1); expect(after.workspaceFiles).toBe(0);
});

test('role focus → unchanged rescan → pinned branch movement → comparison, access control and deleted baseline', async ({ page, context, request }) => {
  const session = await (await request.get(`${backend}/__test/session`)).json(), headers = { Authorization: `Bearer ${session.token}` };
  await context.addCookies([{ name: 'access_token', value: session.token, domain: '127.0.0.1', path: '/' }]);
  const selected = (await (await request.get(`${backend}/api/v1/repository-selections`, { headers })).json()).data;
  const repositoryId = selected.repositories.find((r: { status: string }) => r.status === 'active').repositoryId;
  await request.post(`${backend}/__test/branch`, { data: { repositoryId, version: 'before-test' } });
  await page.goto('/readiness/new'); await page.getByRole('button', { name: 'Start Analysis' }).click();
  await expect(page.getByRole('link', { name: 'View saved report' })).toBeVisible({ timeout: 30000 }); await page.getByRole('link', { name: 'View saved report' }).click();
  await expect(page.getByRole('heading', { name: 'Your project evidence' })).toBeVisible();
  const baselineId = page.url().split('/').at(-1)!, baselineUrl = `/readiness/reports/${baselineId}`;
  const baseline = (await (await request.get(`${backend}/api/v1/readiness-reports/${baselineId}/view`, { headers })).json()).data.report;
  const before = await (await request.get(`${backend}/__test/state`)).json();
  await page.getByRole('combobox', { name: 'Target role focus' }).selectOption('mobile');
  await expect(page.getByText('Role focus saved separately from your report.')).toBeVisible(); await page.reload();
  await expect(page.getByRole('combobox', { name: 'Target role focus' })).toHaveValue('mobile');
  await page.getByRole('region', { name: 'Target role focus' }).scrollIntoViewIfNeeded(); await page.screenshot({ path: 'test-results/run14-role-focus-desktop.png' });
  await page.getByRole('button', { name: 'Rescan selected repositories' }).click(); await expect(page.getByText(/Nothing relevant changed/)).toBeVisible();
  const unchanged = await (await request.get(`${backend}/__test/state`)).json(); expect(unchanged.modelCalls).toBe(before.modelCalls); expect(unchanged.downloads).toBe(before.downloads); expect(unchanged.jobs.length).toBe(before.jobs.length);
  await request.post(`${backend}/__test/branch`, { data: { repositoryId, version: 'after-test' } });
  await request.post(`${backend}/__test/controls`, { data: { paused: true } });
  await context.addCookies([{ name: 'access_token', value: 'expired-fixture', domain: '127.0.0.1', path: '/' }]);
  await page.getByRole('button', { name: 'Rescan selected repositories' }).dblclick(); await expect(page).toHaveURL(/\/readiness\/jobs\//);
  await request.post(`${backend}/__test/branch`, { data: { repositoryId, version: 'later-head' } });
  await request.post(`${backend}/__test/controls`, { data: { paused: false } });
  await expect(page.getByRole('link', { name: 'View saved report' })).toBeVisible({ timeout: 30000 }); await page.getByRole('link', { name: 'View saved report' }).click();
  await expect(page.getByRole('heading', { name: 'Your project evidence' })).toBeVisible();
  const targetId = page.url().split('/').at(-1)!;
  const target = (await (await request.get(`${backend}/api/v1/readiness-reports/${targetId}/view`, { headers })).json()).data.report;
  expect(target.snapshots[0].commitSha).toBe('d'.repeat(40)); expect(baseline.snapshots[0].commitSha).toBe('c'.repeat(40));
  expect((await (await request.get(`${backend}/api/v1/readiness-reports/${baselineId}/view`, { headers })).json()).data.report).toEqual(baseline);
  await page.getByRole('link', { name: 'Compare with baseline' }).click(); await expect(page.getByRole('heading', { name: 'Changes in your project evidence' })).toBeVisible();
  const compareUrl = page.url(), apiUrl = `${backend}/api/v1/readiness-reports/${baselineId}/comparisons?targetReportId=${targetId}`;
  const diff = (await (await request.get(apiUrl, { headers })).json()).data;
  expect(diff.counts.gained).toBeGreaterThan(0); expect(diff.capabilities.some((c: { strengthDelta: number }) => c.strengthDelta > 0)).toBe(true);
  expect(JSON.stringify(diff)).not.toMatch(/contentKey|pathKey|fingerprint|PRIVATE_CUSTOMER|RAW_SOURCE_SENTINEL/);
  await page.evaluate(source => { const script = document.createElement('script'); script.nonce = document.querySelector<HTMLScriptElement>('script[nonce]')?.nonce ?? ''; script.textContent = source; document.head.appendChild(script); }, readFileSync(resolve('node_modules/axe-core/axe.min.js'), 'utf8'));
  const checkAxe = () => page.evaluate(async () => (await (window as unknown as { axe: { run: (target: string) => Promise<{ violations: unknown[] }> } }).axe.run('#main-content')).violations);
  expect(await checkAxe()).toEqual([]); await page.screenshot({ path: 'test-results/run14-comparison-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await checkAxe()).toEqual([]); await page.screenshot({ path: 'test-results/run14-comparison-mobile.png' });
  await page.getByLabel('Evidence change', { exact: true }).selectOption('gained');
  await expect(page.getByText(`${diff.counts.gained} matching observations. ${diff.counts.gained} on this page.`)).toBeVisible();
  await page.getByRole('link', { name: 'Inspect target evidence' }).first().click(); await expect(page.getByRole('heading', { name: 'Evidence explorer' })).toBeFocused(); await expect(page.getByText('1 observations on this page.')).toBeVisible();
  const other = await (await request.get(`${backend}/__test/session?actor=2`)).json();
  expect((await request.get(apiUrl, { headers: { Authorization: `Bearer ${other.token}` } })).status()).toBe(404);
  expect((await request.get(`${backend}/api/v1/readiness-reports/${targetId}/comparisons?targetReportId=${baselineId}`, { headers: { Authorization: `Bearer ${other.token}` } })).status()).toBe(404);
  await request.post(`${backend}/__test/controls`, { data: { enabled: false } }); expect((await request.get(apiUrl, { headers })).status()).toBe(503);
  await page.goto(baselineUrl); await expect(page.getByRole('heading', { name: 'Your project evidence' })).toBeVisible();
  await page.getByRole('region', { name: 'Target role focus' }).scrollIntoViewIfNeeded(); await page.screenshot({ path: 'test-results/run14-role-focus-mobile.png' });
  await request.post(`${backend}/__test/controls`, { data: { enabled: true } });
  await page.getByRole('button', { name: 'Delete analysis', exact: true }).click(); await page.getByRole('button', { name: 'Delete permanently' }).click(); await expect(page).toHaveURL(/\/readiness$/);
  await page.goto(`/readiness/reports/${targetId}`); await expect(page.getByText('The baseline was deleted or is unavailable. It will not be reconstructed.')).toBeVisible();
  await page.goto(compareUrl); await expect(page.getByRole('heading', { name: 'Comparison unavailable' })).toBeVisible();
  const after = await (await request.get(`${backend}/__test/state`)).json(); expect(after.modelCalls).toBe(before.modelCalls + 1); expect(after.downloads).toBe(before.downloads + 1);
  expect(after.events.filter((e: { action: string }) => e.action === 'rescan_completed').length).toBeGreaterThan(0); expect(after.workspaceFiles).toBe(0);
});


test('finding feedback → controlled review → versioned neutral provenance with immutable scores and accessible controls', async ({ page, context, request }) => {
  const session = await (await request.get(`${backend}/__test/session`)).json(), headers = { Authorization: `Bearer ${session.token}` };
  await context.addCookies([{ name: 'access_token', value: session.token, domain: '127.0.0.1', path: '/' }]);
  await request.post(`${backend}/__test/controls`, { data: { enabled: true, feedback: true } });
  const history = (await (await request.get(`${backend}/api/v1/readiness-reports?limit=20`, { headers })).json()).data;
  const baselineId = history.items[0].reportId, baselineUrl = `/readiness/reports/${baselineId}`;
  const baseline = (await (await request.get(`${backend}/api/v1/readiness-reports/${baselineId}/view`, { headers })).json()).data.report;
  const before = await (await request.get(`${backend}/__test/state`)).json();
  await page.goto(baselineUrl); await expect(page.getByRole('heading', { name: 'Your project evidence' })).toBeVisible();
  const summary = page.locator('summary').filter({ hasText: /^Feedback on / }).first();
  await summary.focus(); await page.keyboard.press('Enter');
  await page.getByRole('radio', { name: 'Inaccurate', exact: true }).check(); await page.getByLabel('Optional comment').fill('PRIVATE_FEEDBACK_SENTINEL: please review.');
  await context.addCookies([{ name: 'access_token', value: 'expired-fixture', domain: '127.0.0.1', path: '/' }]);
  await page.getByRole('button', { name: 'Save finding feedback' }).dblclick(); await expect(page.getByText(/Feedback saved for this finding version/)).toBeVisible();
  const firstCap = baseline.capabilityGroups[0].capabilities[0].capabilityId;
  const feedbackUrl = `${backend}/api/v1/readiness-reports/${baselineId}/findings/capability/${firstCap}/feedback`;
  const first = (await (await request.get(feedbackUrl, { headers })).json()).data.feedback; expect(first.revision).toBe(1);
  await page.reload(); await summary.click(); await expect(page.getByRole('radio', { name: 'Inaccurate', exact: true })).toBeChecked();
  await page.getByRole('radio', { name: 'Unclear', exact: true }).check(); await page.getByLabel('Optional comment').fill('Please check the bounded observation.');
  await page.getByRole('button', { name: 'Update finding feedback' }).click(); await expect(page.getByText(/Feedback saved for this finding version/)).toBeVisible();
  const edited = (await (await request.get(feedbackUrl, { headers })).json()).data.feedback; expect(edited.revision).toBe(2); expect(edited.classification).toBe('unclear');
  const queueUrl = `${backend}/api/v1/finding-feedback/review`, reviewHeaders = { ...headers, 'x-admin-key': 'fixture-admin' };
  expect((await request.get(queueUrl, { headers })).status()).toBe(401); expect((await request.get(queueUrl, { headers: reviewHeaders })).status()).toBe(403);
  await request.post(`${backend}/__test/reviewer`); const queue = (await (await request.get(queueUrl, { headers: reviewHeaders })).json()).data;
  expect(queue.items).toHaveLength(1); expect(JSON.stringify(queue)).not.toMatch(/PRIVATE_FEEDBACK|comment|reportId|findingId|source|email/);
  const reviewed = await request.post(`${queueUrl}/${first.id}`, { headers: reviewHeaders, data: { expectedRevision: 2, expectedReviewRevision: 0, disposition: 'needs_reproduction', note: 'needs_fixture', benchmarkCase: 'run15.unknown', idempotencyKey: crypto.randomUUID() } }); expect(reviewed.status()).toBe(200);
  await page.getByRole('button', { name: 'Reload current response' }).click(); await expect(page.getByText(/Review: needs reproduction/)).toBeVisible();
  const afterFeedback = await (await request.get(`${backend}/__test/state`)).json(); expect(afterFeedback.modelCalls).toBe(before.modelCalls); expect(afterFeedback.downloads).toBe(before.downloads);
  expect((await (await request.get(`${backend}/api/v1/readiness-reports/${baselineId}/view`, { headers })).json()).data.report).toEqual(baseline);
  await installAxe(page); const axe = () => page.evaluate(async () => (await (window as unknown as { axe: { run: (target: string) => Promise<{ violations: unknown[] }> } }).axe.run('#main-content')).violations);
  expect(await axe()).toEqual([]); await summary.scrollIntoViewIfNeeded(); await summary.locator('..').screenshot({ path: 'test-results/run15-feedback-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 }); await summary.scrollIntoViewIfNeeded(); expect(await axe()).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true); await summary.locator('..').screenshot({ path: 'test-results/run15-feedback-mobile.png' });
  const other = await (await request.get(`${backend}/__test/session?actor=2`)).json(); expect((await request.get(feedbackUrl, { headers: { Authorization: `Bearer ${other.token}` } })).status()).toBe(404);
  await request.post(`${backend}/__test/controls`, { data: { feedback: false } }); await page.reload(); await summary.click(); await expect(page.getByText(/saved response remains readable/)).toBeVisible();
  await request.post(`${backend}/__test/controls`, { data: { provenance: true } });
  await request.post(`${backend}/__test/branch`, { data: { repositoryId: baseline.snapshots[0].repositoryId, version: 'after-test' } });
  await page.getByRole('button', { name: 'Rescan selected repositories' }).click(); await expect(page.getByRole('link', { name: 'View saved report' })).toBeVisible({ timeout: 30000 });
  await page.getByRole('link', { name: 'View saved report' }).click(); await expect(page.getByRole('heading', { name: 'Contribution and provenance context' })).toBeVisible();
  const targetId = page.url().split('/').at(-1)!, target = (await (await request.get(`${backend}/api/v1/readiness-reports/${targetId}/view`, { headers })).json()).data;
  expect(target.report.versions.aggregationPolicy.version).toBe('1.1.0'); expect(target.report.roles).toEqual(baseline.roles);
  expect(target.aggregation.provenance.snapshots[0].signals).toEqual(expect.arrayContaining(['provider_fork','provider_template_origin','generated_files','vendor_files','history_unavailable']));
  expect(target.aggregation.provenance.snapshots[0].contribution.confidence).toBeNull(); await expect(page.getByText(/Original work may also be present/)).toBeVisible();
  expect((await (await request.get(`${backend}/api/v1/readiness-reports/${baselineId}/view`, { headers })).json()).data.report).toEqual(baseline);
  const after = await (await request.get(`${backend}/__test/state`)).json(); expect(after.modelCalls).toBe(before.modelCalls + 1); expect(after.downloads).toBe(before.downloads); expect(after.workspaceFiles).toBe(0);
  await installAxe(page); const panel = page.getByRole('region', { name: 'Contribution and provenance context' }); await panel.scrollIntoViewIfNeeded(); expect(await axe()).toEqual([]);
  // Standalone panel capture: fixed application chrome would otherwise overlay
  // the middle of an element taller than the viewport. The UI/axe checks use the unmodified page.
  const captureStyle = 'header.fixed, nav[aria-label="Main navigation"] { visibility: hidden; }';
  await panel.screenshot({ path: 'test-results/run15-provenance-mobile.png', style: captureStyle }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1280, height: 1000 }); await panel.scrollIntoViewIfNeeded(); expect(await axe()).toEqual([]); await panel.screenshot({ path: 'test-results/run15-provenance-desktop.png', style: captureStyle });
});

test('mixed language and unsupported reports preserve truthful text and saved access during provider outages', async ({ page, context, request }) => {
  const session = await (await request.get(`${backend}/__test/session`)).json(), headers = { Authorization: `Bearer ${session.token}` };
  await context.addCookies([{ name: 'access_token', value: session.token, domain: '127.0.0.1', path: '/' }]);
  await request.post(`${backend}/__test/controls`, { data: { enabled: true, paused: true } });
  await page.goto('/readiness/new');
  await page.getByLabel('GitHub identity').selectOption({ label: 'fixture-one — connected' });
  await page.getByLabel('Installation', { exact: true }).selectOption({ label: 'fixture-org — Organization, active' });
  for (const id of ['300', '301']) await page.getByRole('checkbox', { name: new RegExp(`synthetic-private-${id}`) }).check();
  await page.getByRole('checkbox', { name: /I own or am authorized/ }).check();
  await page.getByRole('button', { name: 'Save selection' }).click(); await expect(page.getByRole('button', { name: 'Start Analysis' })).toBeEnabled();
  const saved = (await (await request.get(`${backend}/api/v1/repository-selections`, { headers })).json()).data;
  expect(saved.repositories).toHaveLength(2);
  for (const [index, repository] of saved.repositories.entries()) {
    expect((await request.post(`${backend}/__test/workload`, { data: { repositoryId: repository.repositoryId, scenarioId: index === 0 ? 'backend_parse' : 'python_baseline' } })).ok()).toBe(true);
  }
  await page.getByRole('button', { name: 'Start Analysis' }).focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('status').filter({ hasText: 'Waiting for a worker' })).toBeVisible();
  await installAxe(page);
  expect(await page.evaluate(async () => (await (window as unknown as { axe: { run: (target: string) => Promise<{ violations: unknown[] }> } }).axe.run('#main-content')).violations)).toEqual([]);
  await request.post(`${backend}/__test/controls`, { data: { paused: false } });
  await expect(page.getByRole('link', { name: 'View saved report' })).toBeVisible({ timeout: 30000 });
  await page.getByRole('link', { name: 'View saved report' }).click();
  await expect(page.getByRole('heading', { name: 'Your project evidence' })).toBeVisible();
  await expect(page.getByRole('rowheader', { name: 'Python', exact: true })).toBeVisible();
  await expect(page.getByRole('rowheader', { name: 'TypeScript / TSX', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Baseline structure', exact: true }).first()).toBeVisible();
  const reportId = page.url().split('/').at(-1)!;
  const before = await (await request.get(`${backend}/__test/state`)).json();
  const original = (await (await request.get(`${backend}/api/v1/readiness-reports/${reportId}/view`, { headers })).json()).data;
  await request.post(`${backend}/__test/outage`, { data: { github: true, model: true } });
  try {
    const response = await page.reload(); expect(response!.headers()['cache-control']).toContain('no-store');
    await expect(page.getByRole('heading', { name: 'Your project evidence' })).toBeVisible();
    await page.getByRole('button', { name: 'Browse evidence' }).focus(); await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Evidence explorer' })).toBeFocused();
    await expect(page.getByText(/observations on this page/)).toBeVisible();
    await page.getByRole('button', { name: 'Close evidence and return' }).click();
    await installAxe(page);
    expect(await page.evaluate(async () => (await (window as unknown as { axe: { run: (target: string) => Promise<{ violations: unknown[] }> } }).axe.run('#main-content')).violations)).toEqual([]);
    await page.getByRole('heading', { name: 'Your project evidence' }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/run16-mixed-desktop.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await page.evaluate(async () => (await (window as unknown as { axe: { run: (target: string) => Promise<{ violations: unknown[] }> } }).axe.run('#main-content')).violations)).toEqual([]);
    await page.screenshot({ path: 'test-results/run16-mixed-mobile.png' });
    expect((await (await request.get(`${backend}/api/v1/readiness-reports/${reportId}/view`, { headers })).json()).data).toEqual(original);
    const after = await (await request.get(`${backend}/__test/state`)).json(); expect(after.modelCalls).toBe(before.modelCalls); expect(after.downloads).toBe(before.downloads);
  } finally { await request.post(`${backend}/__test/outage`, { data: { github: false, model: false } }); }
  // An unsupported native input is still a completed, truthful unknown report.
  const repositoryId = saved.repositories[0].repositoryId;
  await request.post(`${backend}/__test/workload`, { data: { repositoryId, scenarioId: 'mobile_native_unknown' } });
  const started = await request.post(`${backend}/api/v1/analyses`, { headers, data: { contractVersion: '1.0.0', repositoryIds: [repositoryId], idempotencyKey: crypto.randomUUID() } });
  expect(started.status()).toBe(202); const job = (await started.json()).data;
  await page.goto(`/readiness/jobs/${job.jobId}`); await expect(page.getByRole('link', { name: 'View saved report' })).toBeVisible({ timeout: 30000 });
  await expect(page.getByText(/Insufficient evidence\. Choose repositories/)).toBeVisible();
  await page.getByRole('link', { name: 'View saved report' }).click();
  await expect(page.getByRole('heading', { name: 'Your project evidence' })).toBeVisible();
  const unknownId = page.url().split('/').at(-1)!;
  const unknown = (await (await request.get(`${backend}/api/v1/readiness-reports/${unknownId}/view`, { headers })).json()).data.report;
  expect(unknown.roles).toHaveLength(5); expect(unknown.roles.every((role: { state: string }) => role.state === 'unknown')).toBe(true);
  expect(await page.content()).not.toMatch(/RUN16_|PRIVATE_RECORDS|not employable|unqualified/);
  expect((await (await request.get(`${backend}/__test/state`)).json()).workspaceFiles).toBe(0);
});

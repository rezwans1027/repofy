import { afterEach, expect, it, vi } from 'vitest';
import * as Sentry from '@sentry/nextjs';
import * as BrowserSentry from '@sentry/browser';
import '../../sentry.client.config';

vi.mock('@sentry/nextjs', () => ({ init: vi.fn(), replayIntegration: vi.fn() }));

const options = vi.mocked(Sentry.init).mock.calls[0][0]!;

afterEach(() => {
  window.history.replaceState({}, '', '/');
  document.body.replaceChildren();
});

it('drops every breadcrumb created on a private repository screen', () => {
  window.history.replaceState({}, '', '/readiness/new');
  for (const breadcrumb of [
    { category: 'ui.click', message: 'button[aria-label="Deselect PRIVATE_ORG/PRIVATE_REPO"]' },
    { category: 'console', message: 'PRIVATE_REPOSITORY_SENTINEL' },
    { category: 'fetch', data: { url: '/api/health' } },
  ]) {
    expect(options.beforeBreadcrumb!(breadcrumb, {})).toBeNull();
  }
});

it('drops private request and navigation breadcrumbs after leaving the screen', () => {
  window.history.replaceState({}, '', '/settings');
  for (const data of [
    { from: '/readiness/new', to: '/settings' },
    { from: 'https://repofy.example/readiness#projects', to: '/settings' },
    { from: '/settings', to: '/readiness/new' },
    { url: '/api/v1/repositories?accountId=opaque' },
  ]) {
    expect(options.beforeBreadcrumb!({ data }, {})).toBeNull();
  }
  const publicBreadcrumb = { category: 'navigation', data: { from: '/dashboard', to: '/settings' } };
  expect(options.beforeBreadcrumb!(publicBreadcrumb, {})).toBe(publicBreadcrumb);
});

it('never sends private click text in a later public-screen error with the browser SDK', async () => {
  const envelopes: unknown[] = [];
  window.history.replaceState({}, '', '/readiness/new');
  BrowserSentry.init({
    ...options,
    dsn: 'https://synthetic@example.invalid/1',
    tracesSampleRate: 0,
    defaultIntegrations: false,
    integrations: [BrowserSentry.breadcrumbsIntegration({
      console: false, dom: true, fetch: false, xhr: false, history: true, sentry: false,
    })],
    // Keep the actual SDK capture pipeline, but send nothing over the network.
    transport: () => ({
      send: async envelope => { envelopes.push(envelope); return { statusCode: 200 }; },
      flush: async () => true,
    }),
  });
  try {
    document.body.innerHTML = '<section class="sentry-block" data-sentry-block><button aria-label="Deselect PRIVATE_ORG/PRIVATE_REPO">Deselect</button></section>';
    document.querySelector('button')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    BrowserSentry.captureException(new Error('PRIVATE_ERROR_SENTINEL'));
    await BrowserSentry.flush(2000);
    expect(envelopes).toHaveLength(0);

    window.history.pushState({}, '', '/settings');
    document.body.innerHTML = '<button aria-label="Save settings">Save</button>';
    document.querySelector('button')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    BrowserSentry.captureException(new Error('Public settings error'));
    await BrowserSentry.flush(2000);

    expect(envelopes).toHaveLength(1);
    const payload = JSON.stringify(envelopes);
    expect(payload).toContain('Public settings error');
    expect(payload).toContain('ui.click');
    expect(payload).toContain('Save settings');
    expect(payload).not.toContain('PRIVATE_');
    expect(payload).not.toContain('/readiness');
  } finally {
    await BrowserSentry.close(2000);
    BrowserSentry.getIsolationScope().clear();
    BrowserSentry.getCurrentScope().clear();
  }
});

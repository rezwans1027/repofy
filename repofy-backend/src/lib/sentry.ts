import * as Sentry from "@sentry/node";

// These requests contain OAuth state/codes or private repository display data.
// Their handlers already produce safe operational errors; never send full events/traces.
export function isGitHubConnectionTelemetry(url: string | undefined): boolean {
  return !!url && (/\/api\/v1\/(github|repositories|repository-selections|analyses|readiness-reports|finding-feedback)(?:\/|\?|$)/i.test(url)
    || /\/api\/github-app\/webhook(?:\?|$)/i.test(url)
    || /https:\/\/(?:(?:api\.)?github\.com|codeload\.github\.com|api\.openai\.com)\//i.test(url));
}

export function initSentry() {
  if (!process.env.SENTRY_DSN) return;

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? "production",
    tracesSampleRate: 1.0,
    beforeSend: event => isGitHubConnectionTelemetry(event.request?.url) ? null : event,
    beforeSendTransaction: event => isGitHubConnectionTelemetry(event.request?.url) || isGitHubConnectionTelemetry(event.transaction)
      || event.spans?.some(span => isGitHubConnectionTelemetry(span.description)
        || Object.values(span.data ?? {}).some(value => typeof value === "string" && isGitHubConnectionTelemetry(value))) ? null : event,
    beforeBreadcrumb: breadcrumb => isGitHubConnectionTelemetry(breadcrumb.data?.url as string | undefined) ? null : breadcrumb,
  });
}

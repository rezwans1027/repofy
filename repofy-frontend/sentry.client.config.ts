import * as Sentry from "@sentry/nextjs";
import { isRepositoryAccessTelemetry } from "./src/lib/repository-privacy";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
  tracesSampleRate: 1.0,
  beforeSend: event => isRepositoryAccessTelemetry(event.request?.url) || isRepositoryAccessTelemetry(window.location.pathname) ? null : event,
  beforeSendTransaction: event => isRepositoryAccessTelemetry(event.request?.url) || isRepositoryAccessTelemetry(window.location.pathname) || isRepositoryAccessTelemetry(event.transaction) ? null : event,
  beforeBreadcrumb: breadcrumb => isRepositoryAccessTelemetry(breadcrumb.data?.url as string | undefined)
    || isRepositoryAccessTelemetry(breadcrumb.data?.to as string | undefined) ? null : breadcrumb,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  integrations: [Sentry.replayIntegration()],
});

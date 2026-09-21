import * as Sentry from "@sentry/nextjs";
import { isRepositoryAccessTelemetry } from "./src/lib/repository-privacy";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
  tracesSampleRate: 1.0,
  beforeSend: event => isRepositoryAccessTelemetry(event.request?.url) ? null : event,
  beforeSendTransaction: event => isRepositoryAccessTelemetry(event.request?.url) || isRepositoryAccessTelemetry(event.transaction) ? null : event,
  beforeBreadcrumb: breadcrumb => isRepositoryAccessTelemetry(breadcrumb.data?.url as string | undefined)
    || isRepositoryAccessTelemetry(breadcrumb.data?.to as string | undefined) ? null : breadcrumb,
});

/** Private repository screens/requests must not contribute errors or navigation breadcrumbs. */
export function isRepositoryAccessTelemetry(url?: string): boolean {
  return !!url && (/\/readiness(?:\/|\?|$)/i.test(url)
    || /\/api\/v1\/(?:github|repositories|repository-selections|analyses|readiness-reports|finding-feedback)(?:\/|\?|$)/i.test(url)
    || /\/api\/github-app\/webhook(?:\?|$)/i.test(url));
}

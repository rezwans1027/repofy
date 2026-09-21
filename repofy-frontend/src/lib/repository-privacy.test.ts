import { expect, it } from 'vitest';
import { isRepositoryAccessTelemetry } from './repository-privacy';
it('excludes private screens, callbacks and repository requests from telemetry', () => {
  for (const path of ['/readiness/new', '/api/v1/repositories?accountId=opaque', '/api/v1/repository-selections', '/api/v1/github/installations/authorize?code=sentinel', '/api/github-app/webhook']) expect(isRepositoryAccessTelemetry(path)).toBe(true);
  expect(isRepositoryAccessTelemetry('/dashboard')).toBe(false);
  expect(isRepositoryAccessTelemetry(undefined)).toBe(false);
});

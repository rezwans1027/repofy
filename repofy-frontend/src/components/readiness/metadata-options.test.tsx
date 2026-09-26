import { expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readinessView } from '@/__tests__/fixtures/readiness-view';
import { MetadataChoices, reportMetadataOptions } from './metadata-options';
import type { SelectedRepository } from '@repofy/contracts';

it('recovers original requests from legacy coverage even when metadata was denied or unavailable', () => {
  const view = readinessView();
  view.report.coverage[0].structural = { evidenceTruncated: false, disabledExtractors: [], sources: [], metadata: [
    { source: 'commits', state: 'provider_unavailable', records: 0, exactCommitRecords: 0 },
    { source: 'pullRequests', state: 'permission_denied', records: 0, exactCommitRecords: 0 },
    { source: 'checks', state: 'not_requested', records: 0, exactCommitRecords: 0 },
  ] };
  expect(reportMetadataOptions(view)).toEqual({ commits: true, pullRequests: true, ci: false });
  view.metadataOptions = { commits: false, pullRequests: false, ci: true };
  expect(reportMetadataOptions(view)).toEqual(view.metadataOptions);
});
it('explains missing read scopes while allowing a request that will check current permissions', () => {
  render(<MetadataChoices value={{ commits: false, pullRequests: false, ci: false }} onChange={() => {}} repositories={[
    { metadataPermissions: { contents: 'read', pullRequests: 'none', checks: 'read', actions: 'read', commitStatuses: 'read' } } as SelectedRepository,
  ]} />);
  expect(screen.getAllByText(/Last saved permissions are missing/)).toHaveLength(1);
  expect(screen.getByRole('checkbox', { name: /Include pull request metadata/ })).toBeEnabled();
  expect(screen.getByText(/Missing optional permissions or unavailable metadata/)).toBeInTheDocument();
});

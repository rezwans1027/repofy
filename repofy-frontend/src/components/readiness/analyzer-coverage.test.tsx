import { expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { AnalyzerCoverageSchema, COVERAGE_REASON_LABELS } from '@repofy/contracts';
import fixture from '../../../../docs/benchmarks/run10-example-coverage.json';
import { CoveragePreview, CoverageSummary } from './analyzer-coverage';

const coverage = AnalyzerCoverageSchema.parse(fixture);
it('shows actual language depth and all-file denominator using textual labels and table headers', () => {
  render(<CoverageSummary coverage={coverage} />);
  expect(screen.getByRole('region', { name: 'Analyzer coverage' })).toBeInTheDocument();
  const table = screen.getByRole('table', { name: 'Achieved language coverage' });
  expect(within(table).getByRole('columnheader', { name: 'Depth achieved' })).toBeInTheDocument();
  expect(within(table).getByRole('row', { name: /Python Baseline structure 1 \/ 1 0/ })).toBeInTheDocument();
  expect(within(table).getByRole('row', { name: /Swift Inventory only 0 \/ 1 0/ })).toBeInTheDocument();
  expect(screen.getByText(/5 of 6 discovered files/)).toBeInTheDocument();
  expect(screen.getByText(/file processing counts, not skill scores/)).toBeInTheDocument();
  const mobile = screen.getByRole('list', { name: 'Achieved language coverage' });
  expect(within(mobile).getByText('Swift: Inventory only')).toBeInTheDocument();
  expect(within(mobile).getByText('0 / 1 eligible files structurally analyzed.')).toBeInTheDocument();
});
it('distinguishes unsupported capabilities from no observed evidence and exposes independent source scope', () => {
  render(<CoverageSummary coverage={coverage} />);
  expect(screen.getByText('mobile lifecycle: Not assessable')).toBeInTheDocument();
  expect(screen.getByText('api design: Evidence not observed within assessed scope')).toBeInTheDocument();
  expect(screen.getByText('data modeling: Partially assessable')).toBeInTheDocument();
  expect(screen.getAllByText(COVERAGE_REASON_LABELS.no_observed_evidence).length).toBeGreaterThan(0);
  expect(screen.getByText('Source and history coverage')).toBeInTheDocument();
  expect(screen.getByText(/two pages of 50 per source/)).toBeInTheDocument();
});
it('keeps legacy coverage unknown rather than applying current declared support', () => {
  const legacy = { ...coverage, assessment: undefined }; render(<CoverageSummary coverage={legacy} />);
  expect(screen.getByText('Coverage unknown')).toBeInTheDocument();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});
it('explains insufficient evidence without recommending repeated unsupported scans', () => {
  const empty = structuredClone(coverage); empty.assessment!.result = 'insufficient_evidence'; empty.assessment!.state = 'not_assessable';
  render(<CoverageSummary coverage={empty} />);
  expect(screen.getByText(/Repeating this scan will not add language support/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /retry|pay/i })).not.toBeInTheDocument();
});
it('declares bounded support before selection without claiming achieved deep language coverage', () => {
  render(<CoveragePreview declaration={coverage.assessment!.declaration} />);
  expect(screen.getByRole('complementary', { name: 'Analyzer support' })).toBeInTheDocument();
  expect(screen.getByText('Coverage determined after scanning')).toBeInTheDocument();
  expect(screen.getByRole('list', { name: 'Declared language support' })).toHaveTextContent('Python: Baseline structure');
  expect(screen.getByText(/256 TS\/JS files and 2 MiB/)).toBeInTheDocument();
  expect(screen.getByText(/no reduced scan is offered/)).toBeInTheDocument();
});
it('reports missing preview data and parser quarantine explicitly', () => {
  const { rerender } = render(<CoveragePreview />); expect(screen.getByText(/No language coverage is assumed/)).toBeInTheDocument();
  const declaration = structuredClone(coverage.assessment!.declaration); declaration.disabledParsers = ['python'];
  declaration.entries.find(entry => entry.id === 'python')!.depth = 'unsupported';
  rerender(<CoveragePreview declaration={declaration} />);
  expect(screen.getByText(COVERAGE_REASON_LABELS.parser_disabled)).toBeInTheDocument();
  expect(screen.getByRole('list', { name: 'Declared language support' })).toHaveTextContent('Python: Not supported');
});

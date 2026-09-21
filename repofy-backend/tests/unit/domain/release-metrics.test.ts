import { it, expect } from 'vitest';
import { observations, quantile, proportion, rolloutDecision } from '../../../scripts/release/metrics';
const item = { detector: 'tsjs.request_validation', path: 'endpoint.ts' };
it('counts duplicates and wrong source references as false positives instead of collapsing observations', () => {
  expect(observations([item], [item, item])).toMatchObject({ tp: 1, fp: 1, fn: 0, precision: .5, recall: 1 });
  expect(observations([item], [{ ...item, path: 'other.ts' }])).toMatchObject({ tp: 0, fp: 1, fn: 1 });
});
it('keeps unmeasured precision/recall null and exposes false negatives', () => {
  expect(observations([], [])).toMatchObject({ precision: null, recall: null });
  expect(observations([item], [])).toMatchObject({ precision: null, recall: 0, fn: 1 });
});
it('reports nearest-rank latency without mutating samples and rejects invalid measurements', () => {
  const sample = [50, 10, 30, 20]; expect(quantile(sample, .5)).toBe(20); expect(quantile(sample, .95)).toBe(50);
  expect(sample).toEqual([50, 10, 30, 20]); expect(quantile([], .95)).toBeNull(); expect(() => quantile([-1], .95)).toThrow();
});
it('does not represent zero observed errors as certainty, or zero samples as a pass', () => {
  expect(proportion(0, 0).rate).toBeNull(); expect(proportion(0, 12).interval95![1]).toBeGreaterThan(.02);
  expect(() => proportion(2, 1)).toThrow();
});
it('pending, failed and missing evidence block a rollout; no result enables flags', () => {
  expect(rolloutDecision([{ id: 'live_model', status: 'pending', evidence: 'No successful provider smoke' }])).toMatchObject({ decision: 'hold', blockers: ['live_model'], automaticEnablement: false });
  expect(rolloutDecision([{ id: 'privacy', status: 'failed', evidence: 'Synthetic leak' }]).decision).toBe('hold');
  expect(() => rolloutDecision([{ id: 'privacy', status: 'passed', evidence: '' }])).toThrow();
  expect(rolloutDecision([{ id: 'privacy', status: 'passed', evidence: 'Measured zero failures' }]).decision).toBe('eligible_for_internal_review');
  expect(rolloutDecision([{ id: 'privacy', status: 'passed', evidence: 'Measured zero failures' }], ['privacy', 'live_model'])).toMatchObject({ decision: 'hold', blockers: ['missing:live_model'] });
});

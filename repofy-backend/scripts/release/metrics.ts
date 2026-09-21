import assert from 'node:assert/strict';

export interface Observation { detector: string; path: string }
export function observations(expected: Observation[], actual: Observation[]) {
  const remaining = actual.map(item => ({ ...item }));
  let tp = 0;
  const missing: Observation[] = [];
  for (const item of expected) {
    const index = remaining.findIndex(other => other.detector === item.detector && other.path === item.path);
    if (index < 0) missing.push(item); else { tp++; remaining.splice(index, 1); }
  }
  return { tp, fp: remaining.length, fn: missing.length, missing, unexpected: remaining,
    precision: tp + remaining.length ? tp / (tp + remaining.length) : null,
    recall: tp + missing.length ? tp / (tp + missing.length) : null };
}
export function quantile(values: number[], fraction: number) {
  assert.ok(fraction > 0 && fraction <= 1);
  assert.ok(values.every(value => Number.isFinite(value) && value >= 0));
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(fraction * sorted.length) - 1];
}
// Two-sided 95% Wilson interval; a zero observed failure rate is not a zero upper bound.
export function proportion(successes: number, total: number) {
  assert.ok(Number.isInteger(total) && Number.isInteger(successes) && total >= 0 && successes >= 0 && successes <= total);
  if (!total) return { successes, total, rate: null, interval95: null };
  const z = 1.959963984540054, p = successes / total, d = 1 + z * z / total;
  const midpoint = (p + z * z / (2 * total)) / d;
  const radius = z * Math.sqrt(p * (1 - p) / total + z * z / (4 * total * total)) / d;
  return { successes, total, rate: p, interval95: [Math.max(0, midpoint - radius), Math.min(1, midpoint + radius)] };
}

export interface Gate { id: string; status: 'passed' | 'failed' | 'pending' | 'not_applicable'; evidence: string }
export function rolloutDecision(gates: Gate[], requiredIds: readonly string[] = []) {
  assert.ok(gates.length && new Set(gates.map(g => g.id)).size === gates.length);
  assert.ok(gates.every(g => g.evidence.trim().length && ['passed', 'failed', 'pending', 'not_applicable'].includes(g.status)));
  const blockers = gates.filter(g => g.status === 'failed' || g.status === 'pending').map(g => g.id);
  blockers.push(...requiredIds.filter(id => !gates.some(g => g.id === id)).map(id => `missing:${id}`));
  return { decision: blockers.length ? 'hold' : 'eligible_for_internal_review', blockers, automaticEnablement: false };
}

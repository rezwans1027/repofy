import { describe, expect, it } from 'vitest';
import { detect } from '../../../src/domain/detectors/rules';
import { aggregateEvidence } from '../../../src/domain/aggregation/engine';
import { detectorCases, service } from '../../fixtures/evidence/implementation';
import { indexed } from '../../helpers/detector-index';
import { extractedAggregation } from '../../helpers/aggregation-fixtures';

const sample = (kind: string) => detectorCases.find(c => c.kind === kind)!;
function kinds(path: string, source: string) {
  const project = indexed({ 'service.ts': service, [path]: source });
  return detect(project.files.get(path)!).map(f => f.kind);
}
const stops = [
  'return;',
  'throw new Error();',
  '{ const ignored = 1; return; }',
  'if (req.body) return; else throw new Error();',
  'if (true) return;',
  'if (false) {} else return;',
  'try { return; } finally {}',
  'try {} finally { return; }',
];

describe('reachable straight-line detector observations', () => {
  it.each(stops)('rejects parsed-input and local-boundary credit after %s', stop => {
    const source = sample('request_validation').positive.replace('return save(parsed);', `${stop} save(parsed);`);
    expect(kinds('route.ts', source)).not.toContain('request_validation');
    expect(kinds('route.ts', source)).not.toContain('route_service');
  });
  it.each(stops)('rejects user-consumption credit after %s', stop => {
    const source = sample('authentication_guard').positive.replace('return save(req.user);', `${stop} save(req.user);`);
    expect(kinds('route.ts', source)).not.toContain('authentication_guard');
    expect(kinds('route.ts', source)).not.toContain('route_service');
  });
  it.each(['return;', 'throw new Error();', '{ return; }', 'if (form) return; else return;'])('rejects unreachable validated form submissions after %s', stop => {
    const source = sample('form_validation').positive.replace('save(data);', `${stop} save(data);`);
    expect(kinds('Form.tsx', source)).not.toContain('form_validation');
  });
  it('does not begin form parsing after a returning preventDefault call', () => {
    const source = sample('form_validation').positive.replace('e.preventDefault();', 'return e.preventDefault();');
    expect(kinds('Form.tsx', source)).not.toContain('form_validation');
  });
  it('preserves calls made by return statements and a guard with a continuing path', () => {
    expect(kinds('route.ts', sample('request_validation').positive)).toEqual(expect.arrayContaining(['request_validation', 'route_service']));
    expect(kinds('route.ts', sample('authentication_guard').positive)).toEqual(expect.arrayContaining(['authentication_guard', 'route_service']));
    const source = sample('request_validation').positive.replace('return save(parsed);', 'if (!req.user) return; return save(parsed);');
    expect(kinds('route.ts', source)).toEqual(expect.arrayContaining(['request_validation', 'route_service']));
  });
});

describe('unconditional finally cleanup', () => {
  it.each([
    'if (false) { client.release(); }',
    'if (client) { client.release(); }',
    'client && client.release();',
    'return; client.release();',
    'throw new Error(); client.release();',
    'if (client) return; client.release();',
    'if (client) throw new Error(); client.release();',
    '{ return; } client.release();',
    'beforeCleanup(); client.release();',
    'const later = () => client.release();',
  ])('does not credit conditional or bypassable cleanup: %s', cleanup => {
    const source = sample('failure_cleanup').positive.replace('client.release();', cleanup);
    expect(kinds('cleanup.ts', source)).not.toContain('failure_cleanup');
  });
  it.each(['client.release();', 'return client.release();', '; { ; client.release(); }', 'client.release(); return;'])('preserves an immediate release: %s', cleanup => {
    const source = sample('failure_cleanup').positive.replace('client.release();', cleanup);
    expect(kinds('cleanup.ts', source)).toContain('failure_cleanup');
  });
  it('requires a reachable query in the guarded try block', () => {
    const source = sample('failure_cleanup').positive.replace("await client.query('SELECT 1');", "return; await client.query('SELECT 1');");
    expect(kinds('cleanup.ts', source)).not.toContain('failure_cleanup');
  });
});

it('does not award capability strength for unreachable consumers or conditional cleanup', async () => {
  const { input, bundle } = await extractedAggregation({
    'service.ts': service,
    'validation.ts': sample('request_validation').positive.replace('return save(parsed);', 'return; save(parsed);'),
    'authentication.ts': sample('authentication_guard').positive.replace('return save(req.user);', 'return; save(req.user);'),
    'cleanup.ts': sample('failure_cleanup').positive.replace('client.release();', 'if (false) { client.release(); }'),
  });
  const observations = bundle.evidence.filter(e => e.implementation).map(e => e.implementation!.kind);
  for (const kind of ['request_validation', 'authentication_guard', 'failure_cleanup']) expect(observations).not.toContain(kind);
  const result = aggregateEvidence(input);
  for (const capabilityId of ['api_boundary_validation', 'architecture_modularity', 'security_input_handling', 'reliability_recovery']) {
    expect(result.capabilities.find(c => c.capabilityId === capabilityId)).toMatchObject({ state: 'not_observed', strength: 0, evidenceIds: [] });
  }
});

import { describe, expect, it } from 'vitest';
import { detect } from '../../../src/domain/detectors/rules';
import { aggregateEvidence } from '../../../src/domain/aggregation/engine';
import { detectorCases, service } from '../../fixtures/evidence/implementation';
import { indexed } from '../../helpers/detector-index';
import { extractedAggregation } from '../../helpers/aggregation-fixtures';
import { narrativeFixture } from '../../helpers/narrative-fixtures';
import { renderNarrative } from '../../../src/domain/synthesis/narrative';

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

describe('state guards reject input before performing work', () => {
  it.each([
    'return save(item);', 'return await save(item);', 'throw save(item);',
    'return (save(item), false);', 'return item.reject();', 'throw new Error(save(item));',
    '{ return save(item); }',
  ])('does not credit a rejecting branch with unproven effects: %s', exit => {
    const source = `import {save} from './service'; export async function run(item){if(item.state!=='ready') ${exit} return save(item);}`;
    expect(kinds('state.ts', source)).not.toContain('state_guard');
  });
  it.each(['return;', 'return false;', 'return null;', 'return undefined;', '{ return; }', 'throw new Error("Unexpected state");'])('preserves a rejecting exit without work: %s', exit => {
    const source = `import {save} from './service'; export function run(item){if(item.state!=='ready') ${exit} return save(item);}`;
    expect(kinds('state.ts', source)).toContain('state_guard');
  });
  it('does not assume a shadowed Error constructor is harmless', () => {
    const source = `import {save} from './service'; const Error=save; export function run(item){if(item.state!=='ready') throw new Error(item); return save(item);}`;
    expect(kinds('state.ts', source)).not.toContain('state_guard');
  });
  it('does not award concurrency strength or publish a claim when both branches perform the operation', async () => {
    const f = await narrativeFixture({ 'service.ts': service,
      'state.ts': `import {save} from './service'; export async function run(item){if(item.state!=='ready') return await save(item); return save(item);}` });
    expect(f.p.facts.aggregation.capabilities.find(c => c.capabilityId === 'reliability_concurrency')).toMatchObject({ state: 'not_observed', strength: 0 });
    const report = renderNarrative(f.p, f.selection, f.modelRunId);
    expect(report.claims.some(c => c.verification === 'verified' && c.capabilityIds.includes('reliability_concurrency'))).toBe(false);
  });
});

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

describe('reachability across every implementation detector path', () => {
  const cases = [
    ['ownership_guard', 'const resource =', 'return res.json({}); const resource ='],
    ['structured_error', 'if (!req.body)', 'return res.json({}); if (!req.body)'],
    ['parameterized_query', 'return await db.query', '{ return; } return await db.query'],
    ['transaction', 'await tx.first.create', 'return await tx.first.create'],
    ['bounded_retry', 'retry(){for', 'retry(){return;for'],
    ['failure_cleanup', 'try{', 'return;try{'],
    ['bounded_model_output', 'return await generateObject', 'return; return await generateObject'],
    ['asserted_call', '()=>{expect', '()=>{{return;}expect'],
    ['request_state', 'reload(){', 'reload(){return;'],
  ];
  it.each(cases)('rejects unreachable %s evidence', (kind, from, to) => {
    const fixture = sample(kind);
    expect(kinds(fixture.path, fixture.positive.replace(from, to))).not.toContain(kind);
  });
  it.each(['if(false){CALL}', 'if(false as const){CALL}', 'while(false){CALL}', 'for(;false;){CALL}', 'false && CALL', 'true || CALL', 'false ?? CALL', 'false ? CALL : undefined'])('rejects a query on a statically dead path: %s', wrapper => {
    const source = sample('parameterized_query').positive.replace("return await db.query('SELECT id FROM things WHERE id=$1',[id]);",
      wrapper.replace('CALL', "await db.query('SELECT id FROM things WHERE id=$1',[id])") + ';');
    expect(kinds('query.ts', source)).not.toContain('parameterized_query');
  });
  it.each(['route_service', 'request_validation', 'authentication_guard', 'ownership_guard', 'structured_error'])('requires a reachable route registration for %s', kind => {
    const fixture = sample(kind);
    const source = fixture.positive.replace('app.post(', 'if(false){app.post(') + '}';
    expect(kinds(fixture.path, source)).not.toContain(kind);
  });
  it.each(['accessible_action', 'form_validation', 'request_state'])('requires reachable JSX for %s', kind => {
    const fixture = sample(kind);
    expect(kinds(fixture.path, fixture.positive.replace('return <', 'return null; return <'))).not.toContain(kind);
  });
  it('rejects assertions registered after a top-level throw', () => {
    const source = sample('asserted_call').positive.replace("test('example'", "throw new Error(); test('example'");
    expect(kinds('service.test.ts', source)).not.toContain('asserted_call');
  });
  it('preserves a second awaited write returned by the transaction callback', () => {
    const source = sample('transaction').positive.replace('await tx.second.create', 'return await tx.second.create');
    expect(kinds('write.ts', source)).toContain('transaction');
  });
  it('inspects hoisted function bodies independently from their declaration position', () => {
    const source = `import {Pool} from 'pg'; const db=new Pool(); export function setup(){return read;
      async function read(id){return await db.query('SELECT id FROM things WHERE id=$1',[id]);}}`;
    expect(kinds('query.ts', source)).toContain('parameterized_query');
  });
  it.each([
    'return; const read=async(id)=>{QUERY};',
    'return; const read=async function(id){QUERY};',
    'if(false){async function read(id){QUERY}}',
    'return; {async function read(id){QUERY}}',
    'return; const reader={async read(id){QUERY}};',
  ])('requires reachable function creation or declaration scope: %s', body => {
    const source = `import {Pool} from 'pg';const db=new Pool();export function setup(){${body.replace('QUERY', "return await db.query('SELECT id FROM things WHERE id=$1',[id]);")}}`;
    expect(kinds('query.ts', source)).not.toContain('parameterized_query');
  });
  it('does not infer a library origin from an unreachable initializer', () => {
    const source = `import {Pool} from 'pg';export async function read(id){return await db.query('SELECT id FROM things WHERE id=$1',[id]);const db=new Pool();}`;
    expect(kinds('query.ts', source)).not.toContain('parameterized_query');
  });
  it('keeps a reachable query on a conditional path', () => {
    const source = sample('parameterized_query').positive.replace('return await', 'if(id) return await');
    expect(kinds('query.ts', source)).toContain('parameterized_query');
  });
});

describe('request-state effects cannot be bypassed', () => {
  it('does not count state displayed only in unreachable JSX', () => {
    const source = sample('request_state').positive.replace('return <', 'return <button onClick={reload}>Load</button>; return <');
    expect(kinds('Load.jsx', source)).not.toContain('request_state');
  });
  it.each([
    'if(false){setPending(false);}', 'if(shouldReset){setPending(false);}',
    'return; setPending(false);', '{throw new Error();} setPending(false);',
    'beforeReset(); setPending(false);', 'const later=()=>setPending(false);',
  ])('rejects conditional or late pending reset: %s', reset => {
    const source = sample('request_state').positive.replace('finally{setPending(false);}', `finally{${reset}}`);
    expect(kinds('Load.jsx', source)).not.toContain('request_state');
  });
  it.each(['if(ready){setPending(true);}', 'false && setPending(true);'])('requires direct pending setup: %s', setup => {
    const source = sample('request_state').positive.replace('setPending(true);', setup);
    expect(kinds('Load.jsx', source)).not.toContain('request_state');
  });
  it('requires an immediate error-state setter in catch', () => {
    const source = sample('request_state').positive.replace('catch(e){setError(true);}', 'catch(e){if(ready){setError(true);}}');
    expect(kinds('Load.jsx', source)).not.toContain('request_state');
  });
  it.each(['setPending(false);', '; { ; setPending(false); }', 'return setPending(false);'])('preserves immediate unconditional reset: %s', reset => {
    const source = sample('request_state').positive.replace('finally{setPending(false);}', `finally{${reset}}`);
    expect(kinds('Load.jsx', source)).toContain('request_state');
  });
});

it('does not publish unsupported claims or corroboration from unreachable assertions', async () => {
  const f = await narrativeFixture({ 'service.ts': service,
    'route.ts': sample('ownership_guard').positive.replace('const resource =', 'return res.json({}); const resource ='),
    'write.ts': sample('transaction').positive.replace('await tx.first.create', 'return await tx.first.create'),
    'Load.jsx': sample('request_state').positive.replace('finally{setPending(false);}', 'finally{if(false){setPending(false);}}'),
    'retry.ts': sample('bounded_retry').positive,
    'retry.test.ts': `import {test,expect} from 'vitest';import {retry} from './retry';test('retry',async()=>{{return;}expect(await retry()).toBe(1);});`,
  });
  const report = renderNarrative(f.p, f.selection, f.modelRunId);
  for (const capability of ['security_authorization', 'api_design', 'data_transactions', 'frontend_interaction', 'testing_behavior']) {
    expect(f.p.facts.aggregation.capabilities.find(c => c.capabilityId === capability)).toMatchObject({ state: 'not_observed', strength: 0 });
    expect(report.claims.some(c => c.verification === 'verified' && c.capabilityIds.includes(capability))).toBe(false);
  }
  expect(f.p.facts.aggregation.capabilities.find(c => c.capabilityId === 'reliability_recovery')).toMatchObject({ strength: .55 });
  expect(report.claims.some(c => c.text.includes('linked test assertion'))).toBe(false);
});

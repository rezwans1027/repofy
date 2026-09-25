import { describe, expect, it } from 'vitest';
import { detect } from '../../../src/domain/detectors/rules';
import { renderNarrative } from '../../../src/domain/synthesis/narrative';
import { service } from '../../fixtures/evidence/implementation';
import { indexed } from '../../helpers/detector-index';
import { narrativeFixture } from '../../helpers/narrative-fixtures';

const guards = [
  { kind: 'authentication_guard', capability: 'api_boundary_validation', status: 401,
    setup: '', condition: '!req.user', subject: 'req.user' },
  { kind: 'ownership_guard', capability: 'security_authorization', status: 403,
    setup: 'const resource = load(req.params.id);', condition: 'resource.ownerId !== req.user.id', subject: 'resource' },
] as const;
function route(guard: typeof guards[number], payload: string) {
  return `import express from 'express'; import {save, load} from './service'; const app = express();
    app.post('/', async (req, res) => { ${guard.setup}
      if (${guard.condition}) return res.status(${guard.status}).json(${payload});
      return save(${guard.subject});
    });`;
}
function kinds(source: string) {
  const project = indexed({ 'service.ts': service, 'route.ts': source });
  return detect(project.files.get('route.ts')!).map(f => f.kind);
}

for (const guard of guards) describe(`${guard.kind} denial payloads`, () => {
  const value = guard.subject;
  it.each([
    `result: save(${value})`,
    `result: await save(${value})`,
    `result: (save(${value}), false)`,
    `details: { result: save(${value}) }`,
    `results: [save(${value})]`,
    `get result() { return save(${value}); }`,
    `toJSON() { return save(${value}); }`,
    `toJSON: () => save(${value})`,
    `result: ${value}`,
    `result: ${value}.detail`,
    `...save(${value})`,
    `[save(${value})]: 'denied'`,
    'result: `${save(' + value + ')}`',
    `result: new ResponseData(${value})`,
  ])('does not credit unproven denial-payload effects: %s', property => {
    expect(kinds(route(guard, `{code: 'DENIED', ${property}}`))).not.toContain(guard.kind);
  });

  it.each([
    "{code: 'DENIED'}",
    "{code: 'DENIED', message: 'Access denied', details: { retry: false, count: 2, offset: -1, value: null, tags: ['denied', {text: `try again`}] }}",
    "{code: 'DENIED', details: [(true), (1 as const), +2]}",
  ])('preserves an inert JSON denial: %s', payload => {
    expect(kinds(route(guard, payload))).toEqual(expect.arrayContaining([guard.kind, 'structured_error']));
  });

  it('retains the narrower structured-error observation for a dynamic response body', () => {
    const findings = kinds(route(guard, `{code: 'DENIED', result: save(${value})}`));
    expect(findings).toContain('structured_error');
    expect(findings).not.toContain(guard.kind);
  });

  it.each([false, true])('publishes guard evidence only for an inert denial; protected work in payload: %s', async effect => {
    const f = await narrativeFixture({ 'service.ts': service,
      'route.ts': route(guard, `{code: 'DENIED'${effect ? `, result: save(${value})` : ''}}`) });
    expect(f.p.facts.aggregation.capabilities.find(c => c.capabilityId === guard.capability))
      .toMatchObject(effect ? { state: 'not_observed', strength: 0 } : { state: 'assessed', strength: 0.55 });
    const report = renderNarrative(f.p, f.selection, f.modelRunId);
    expect(report.claims.some(c => c.verification === 'verified' && c.capabilityIds.includes(guard.capability))).toBe(!effect);
  });
});

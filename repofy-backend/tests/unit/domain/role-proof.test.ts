import { expect, it } from 'vitest';
import { implementedRolePortfolio } from '../../helpers/role-coverage-v3';
import { indexed } from '../../helpers/detector-index';
import { narrativeFixture } from '../../helpers/narrative-fixtures';
import { renderNarrative, validateRendered } from '../../../src/domain/synthesis/narrative';
import { detect } from '../../../src/domain/detectors/rules';
import { narrativeExecutionPolicy } from '../../../src/domain/synthesis/composition';

const form = implementedRolePortfolio()['Form.jsx'];
const guard = implementedRolePortfolio()['model-guard.ts'];
const controls = ['<label htmlFor="name">Name</label>', '<input id="name" value={name} onChange={change}/>', '<button type="submit">Save</button>'];
function has(path: string, source: string, kind: 'labelled_control' | 'model_action_guard') {
  const project = indexed({ ...implementedRolePortfolio(), [path]: source });
  return detect(project.files.get(path)!, true).some(f => f.kind === kind);
}

for (const control of controls) {
  it.each(['{false && CONTROL}', '{true ? null : CONTROL}', '{() => CONTROL}', '<Custom>CONTROL</Custom>', '<div content={CONTROL}/>', '<form>CONTROL</form>'])
    (`rejects non-rendered or separately owned ${control.split(' ')[0]}: %s`, wrapper => {
      expect(has('Form.jsx', form.replace(control, wrapper.replace('CONTROL', control)), 'labelled_control')).toBe(false);
    });
}
it('rejects mutually exclusive required controls', () => {
  const source = form.replace(controls[0] + controls[1], `{ready ? ${controls[0]} : ${controls[1]}}`);
  expect(has('Form.jsx', source, 'labelled_control')).toBe(false);
});
it.each(['false', '0', "''", 'null', 'undefined', '!true'])('rejects a common dead branch behind a local constant %s', value => {
  const source = form.replace('export function Form()', `const visible=${value};export function Form()`)
    .replace(controls.join(''), `{visible && <>${controls.join('')}</>}`);
  expect(has('Form.jsx', source, 'labelled_control')).toBe(false);
});
it.each(['input', 'button'])('rejects a %s explicitly assigned to another form', tag => {
  expect(has('Form.jsx', form.replace(`<${tag} `, `<${tag} form="other" `), 'labelled_control')).toBe(false);
});
it.each(['true', 'ready'])('accepts controls rendered together under %s', condition => {
  const source = form.replace(controls.join(''), `{${condition} && <>${controls.join('')}</>}`);
  expect(has('Form.jsx', source, 'labelled_control')).toBe(true);
});
it.each(['<template>FORM</template>', '<Custom content={FORM}/>', '<div>{() => FORM}</div>'])('does not mistake a form held in %s for a rendered form', wrapper => {
  const markup = form.slice(form.indexOf('<form'), form.indexOf('</form>') + 7);
  expect(has('Form.jsx', form.replace(markup, wrapper.replace('FORM', markup)), 'labelled_control')).toBe(false);
});
const mutations = [
  'allowed.push(prompt)', 'allowed.splice(0, 2, prompt)', 'allowed.fill(prompt)', 'allowed["push"](prompt)',
  'Object.setPrototypeOf(allowed,{includes(){return true;}})', 'Reflect.setPrototypeOf(allowed,{includes(){return true;}})',
  'Object.defineProperty(allowed,"includes",{value:()=>true})', 'alter(allowed)',
  '(()=>{const alias=allowed;alias.push(prompt);})()', '(()=>{const alias=allowed;alter(alias);})()',
  '(()=>{const {push}=allowed;push.call(allowed,prompt);})()', '(()=>{return allowed;})()',
];
it.each(mutations)('rejects an allowlist mutation or escape: %s', mutation => {
  expect(has('model-guard.ts', guard.replace("model:'fixture-model'", `model:(${mutation},'fixture-model')`), 'model_action_guard')).toBe(false);
});
it('rejects an exported array even when its local uses are reads', () => {
  expect(has('model-guard.ts', guard.replace('const allowed=', 'export const allowed='), 'model_action_guard')).toBe(false);
});
it.each([
  guard,
  guard.replace('!allowed.includes', "!['read','skip'].includes"),
  guard.replace('export async', 'const alias=allowed;export async').replace('!allowed.includes', '!alias.includes'),
  guard.replaceAll('allowed', 'permitted'),
])('accepts a local literal allowlist with no mutation or escape %#', source => {
  expect(has('model-guard.ts', source, 'model_action_guard')).toBe(true);
});

const counterexamples = [
  ...controls.map(control => ({ path: 'Form.jsx', source: form.replace(control, `{false && ${control}}`), kind: 'labelled_control', capability: 'frontend_accessibility', role: 'frontend' })),
  ...mutations.slice(0, 1).concat(mutations.slice(4, 6)).map(mutation => ({ path: 'model-guard.ts', source: guard.replace("model:'fixture-model'", `model:(${mutation},'fixture-model')`), kind: 'model_action_guard', capability: 'ai_safety', role: 'ai_application' })),
];
it.each(counterexamples)('removes false $kind claims and their role contribution end to end ($source)', async sample => {
  const files = { ...implementedRolePortfolio(sample.path === 'Form.jsx' ? 'frontend' : 'ai_application'), [sample.path]: sample.source };
  const old = await narrativeFixture(files, '3.0.0', '2.0.0');
  const current = await narrativeFixture(files, '3.0.0');
  const before = renderNarrative(old.p, old.selection, old.modelRunId);
  const report = renderNarrative(current.p, current.selection, current.modelRunId);
  validateRendered(report, current.p);
  const falseIds = before.evidence.filter(e => e.implementation?.kind === sample.kind).map(e => e.evidenceId);
  expect(falseIds.length).toBeGreaterThan(0);
  expect(before.claims.some(c => c.verification === 'verified' && c.evidenceIds.some(id => falseIds.includes(id)))).toBe(true);
  expect(current.p.facts.evidence.some(e => e.implementation?.kind === sample.kind)).toBe(false);
  const oldCap = old.p.facts.aggregation.capabilities.find(c => c.capabilityId === sample.capability)!;
  const cap = current.p.facts.aggregation.capabilities.find(c => c.capabilityId === sample.capability)!;
  expect(cap.strength ?? 0).toBeLessThan(oldCap.strength!);
  const oldRole = old.p.facts.aggregation.roles.find(r => r.template.roleId === sample.role)!;
  expect(current.p.facts.aggregation.roles.find(r => r.template.roleId === sample.role)!.coverage).toBeLessThan(oldRole.coverage!);
  expect(report.versions.detectorBundle.version).toBe('2.0.1');
  expect(before.versions.detectorBundle.version).toBe('2.0.0');
});
it('pins corrected intake while preserving the previous queued composition', () => {
  expect(narrativeExecutionPolicy().versions.detectorBundle.version).toBe('2.0.1');
  expect(narrativeExecutionPolicy(false, '3.0.0', '2.0.0').versions.detectorBundle.version).toBe('2.0.0');
});

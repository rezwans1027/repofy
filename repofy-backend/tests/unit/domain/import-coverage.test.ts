import { expect, it } from 'vitest';
import { indexed } from '../../helpers/detector-index';
import { extractedAggregation } from '../../helpers/aggregation-fixtures';

const query = "import {Pool} from 'pg'; const pool=new Pool(); export async function read(id){return await pool.query('SELECT id FROM records WHERE id=$1',[id]);}";
it('keeps supported external imports out of unresolved scope without losing query evidence', async () => {
  const { bundle } = await extractedAggregation({ 'query.ts': query });
  expect(bundle.evidence.some(e => e.implementation?.kind === 'parameterized_query')).toBe(true);
  expect(bundle.coverage.implementation).toMatchObject({ unresolvedImports: 0, aliasConfigurationsRejected: 0, analyzedFiles: 1 });
  expect(bundle.coverage.assessment?.state).toBe('assessable');
  expect(bundle.coverage.assessment?.reasons).not.toContain('resolution_incomplete');
  expect(bundle.coverage.assessment?.capabilities.every(c => !c.reasons.includes('resolution_incomplete'))).toBe(true);
});
it('recognizes literal package and builtin imports, including destructured CommonJS', () => {
  const project = indexed({ 'source.ts': "import React from 'react'; import * as z from 'zod'; import {test,expect} from 'vitest'; import {readFile} from 'node:fs/promises'; import {stat} from 'fs'; import {value} from '@scope/package/subpath'; const {Pool}=require('pg');" });
  expect(project.stats.unresolvedImports).toBe(0);
});
it.each(['', '/local', '#internal', '..\\local', 'https://example.invalid/module.js', 'file:///local.js'])(
  'keeps unsupported module references unresolved: %s', source => {
    expect(indexed({ 'source.ts': `import {value} from ${JSON.stringify(source)};` }).stats.unresolvedImports).toBe(1);
  });
it('retains missing, ambiguous and rejected local resolution as incomplete', () => {
  expect(indexed({ 'source.ts': "import {value} from './missing'; import type {Type} from './type-only';" }).stats.unresolvedImports).toBe(1);
  const files = { 'source.ts': "import {value} from './local';", 'local.ts': 'export const value=1;', 'local.js': 'export const value=1;' };
  expect(indexed(files).stats.unresolvedImports).toBe(1);
  expect(indexed({ 'source.ts': "import {value} from './local';", 'local.ts': files['local.ts'] }).stats.unresolvedImports).toBe(0);
  const config = { 'tsconfig.json': '{"compilerOptions":{"baseUrl":".","paths":{"pg":["./missing"]}}}' };
  expect(indexed({ 'query.ts': query }, config).stats.unresolvedImports).toBe(1);
  const inherited = indexed({ 'query.ts': query }, { 'tsconfig.json': '{"extends":"./base.json"}' });
  expect(inherited.stats).toMatchObject({ unresolvedImports: 1, aliasConfigurationsRejected: 1 });
});

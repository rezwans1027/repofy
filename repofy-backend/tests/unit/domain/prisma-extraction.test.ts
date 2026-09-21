import { describe, expect, it } from 'vitest';
import { schemas } from '../../../src/domain/extraction/configuration';
import { ParseFailure } from '../../../src/domain/extraction/policy';
import { aggregateEvidence } from '../../../src/domain/aggregation/engine';
import { extractedAggregation } from '../../helpers/aggregation-fixtures';

const model = 'model User {\n  id Int @id\n}';
const extract = (text: string) => schemas.extract({ path: 'schema.prisma', text, language: 'prisma', classification: 'schema' });

describe('Prisma lexical boundaries', () => {
  it.each([
    '// model Removed {\n// id Int @id\n// }',
    '/// model Removed {\n/// id Int @id\n/// }',
    '/* model Removed {\n id Int @id\n} */',
    '// This user\'s old model was removed',
    'generator client {\n provider = "model Removed { // /*"\n}',
    'model "NotAnIdentifier" { id Int @id }',
    String.raw`generator client { provider = "escaped \" model Removed {" }`,
  ])('never counts declarations inside comments or strings: %s', text => {
    expect(extract(text)).toEqual({ state: 'analyzed', findings: [] });
  });

  it.each([
    '// This user\'s identity\n',
    '/// The user\'s identity uses a "stable" key\n',
    '/* The user\'s "stable" identity */\n',
    '// A quoted example: "model Removed {"\r\n',
    'generator client { provider = "// not a comment /*" }\n',
  ])('preserves real models after Prisma comment/string syntax: %s', prefix => {
    expect(extract(prefix + model).findings[0].detail.counts).toEqual({ models: 1 });
  });

  it.each([
    '/* unfinished\n' + model,
    'generator client { provider = "unfinished }\n' + model,
    "generator client { provider = 'invalid' }\n" + model,
    '*/\n' + model,
    '/* outer /* nested */\n' + model,
    'generator client { provider = "escaped\\\n' + model,
  ])('fails closed on malformed or unsupported lexical syntax: %s', text => {
    expect(() => extract(text)).toThrow(ParseFailure);
  });

  it('keeps SQL comment and quoted-body handling separate', () => {
    const result = schemas.extract({ path: 'schema.sql', language: 'sql', classification: 'schema',
      text: "-- CREATE TABLE removed(id INT);\nSELECT 'CREATE TABLE quoted(id INT);';\nCREATE TABLE actual(id INT);" });
    expect(result.findings[0].detail.counts).toEqual({ tables: 1, indexes: 0, alterations: 0 });
  });
});

it('does not award data-modeling strength for a commented-out Prisma model', async () => {
  const { input, bundle } = await extractedAggregation({ 'schema.prisma': '// model Removed {\n// id Int @id\n// }' });
  expect(bundle.evidence.some(e => e.structural?.kind === 'schema')).toBe(false);
  expect(aggregateEvidence(input).capabilities.find(c => c.capabilityId === 'data_modeling'))
    .toMatchObject({ state: 'not_observed', strength: 0, evidenceIds: [] });
});

it('retains bounded schema evidence when a valid model has an apostrophe in its comment', async () => {
  const { input, bundle } = await extractedAggregation({ 'schema.prisma': "// This user's identity\n" + model });
  expect(bundle.evidence.find(e => e.structural?.kind === 'schema')?.structural?.counts).toEqual({ models: 1 });
  expect(aggregateEvidence(input).capabilities.find(c => c.capabilityId === 'data_modeling'))
    .toMatchObject({ state: 'assessed', strength: 0.3 });
});

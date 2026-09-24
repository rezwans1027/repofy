import { expect, it } from 'vitest';
import { containsSqlData } from '../../../src/domain/ingestion/exclusions';
import { extractionFixture } from '../../helpers/extraction-fixtures';

const quotedMarkers = ["'--'", "'/*'", "'it''s -- text'", '"--column"', '`/*column`', '[--column]', '$$--$$', '$marker$/*$marker$'];
const dialectInserts = [
  ...['ROLLBACK', 'ABORT', 'REPLACE', 'FAIL', 'IGNORE'].map(action => `INSERT OR ${action} INTO records VALUES ('SYNTHETIC_RECORD');`),
  ...['IGNORE', 'LOW_PRIORITY IGNORE', 'DELAYED', 'HIGH_PRIORITY'].map(modifier => `INSERT ${modifier} INTO records VALUES ('SYNTHETIC_RECORD');`),
  "REPLACE INTO records VALUES ('SYNTHETIC_RECORD');",
  "REPLACE LOW_PRIORITY INTO records VALUES ('SYNTHETIC_RECORD');",
  "INSERT records VALUES ('SYNTHETIC_RECORD');",
  "INSERT IGNORE `private records` (label) VALUES ('SYNTHETIC_RECORD');",
  'REPLACE DELAYED "private records" SET label=\'SYNTHETIC_RECORD\';',
  "INSERT db.records PARTITION (p0) VALUES ('SYNTHETIC_RECORD');",
  "REPLACE records SELECT 'SYNTHETIC_RECORD';",
  "INSERT /* modifier */ OR -- conflict action\n IGNORE /* target */ INTO records VALUES ('SYNTHETIC_RECORD');",
];
it.each(dialectInserts)('screens dialect-specific data writes: %s', sql => {
  expect(containsSqlData(sql)).toBe(true);
  expect(containsSqlData(`CREATE FUNCTION f() RETURNS void AS $$ BEGIN ${sql} END; $$ LANGUAGE plpgsql;`)).toBe(true);
});
it.each(['/*!50000 INSERT IGNORE INTO records VALUES (1) */', '/*M!100100 REPLACE INTO records VALUES (1) */'])(
  'fails closed on executable comments: %s', sql => { expect(containsSqlData(sql)).toBe(true); });
it.each([
  "CREATE OR REPLACE VIEW current_records AS SELECT label FROM records;",
  "CREATE OR REPLACE FUNCTION normalize_label(label TEXT) RETURNS TEXT AS $$ SELECT REPLACE(label, '-', '_'); $$ LANGUAGE sql;",
  "CREATE TABLE records (label TEXT DEFAULT (REPLACE ('a-b', '-', '_')));",
  "CREATE TABLE records (label TEXT); /* INSERT OR REPLACE INTO records VALUES ('example'); */",
])('preserves schema declarations and non-executable comments: %s', sql => { expect(containsSqlData(sql)).toBe(false); });
it.each(quotedMarkers)('keeps data statements after quoted comment markers: %s', quoted => {
  expect(containsSqlData(`CREATE TABLE records (label TEXT DEFAULT ${quoted}); INSERT INTO records VALUES ('SYNTHETIC_RECORD');`)).toBe(true);
});
it.each(["'--'", "'/*'", "'it''s -- text'", '$$--$$', '$marker$/*$marker$'])('allows schema-only defaults containing %s', quoted => {
  expect(containsSqlData(`CREATE TABLE records (label TEXT DEFAULT ${quoted}); /* actual comment */`)).toBe(false);
});
it('still screens stored SQL bodies and comment-separated statements', () => {
  for (const text of [
    "CREATE FUNCTION f() RETURNS void AS $$ BEGIN INSERT /* actual comment */ INTO records VALUES ('SYNTHETIC_RECORD'); END; $$ LANGUAGE plpgsql;",
    "CREATE TABLE records (label TEXT DEFAULT 'INSERT INTO records VALUES (1)');",
    "CREATE TABLE records (label TEXT DEFAULT '--'); UPDATE /* nested /* comment */ done */ records SET label='SYNTHETIC_RECORD';",
    "CREATE TABLE records (label TEXT DEFAULT E'it\\'s -- text'); DELETE FROM records;",
  ]) expect(containsSqlData(text)).toBe(true);
});
it.each(["'unterminated --", '"unterminated /*', '`unterminated', '[unterminated', '$body$unterminated'])('excludes uncertain SQL quoting: %s', text => {
  expect(containsSqlData(text)).toBe(true);
});
it('excludes data-bearing SQL before giving extractors a read capability', async () => {
  const f = await extractionFixture({
    ...Object.fromEntries(dialectInserts.map((sql, i) => [`migrations/dialect_${i}.sql`, `CREATE TABLE records (label TEXT); ${sql}`])),
    'schema.sql': "CREATE TABLE records (label TEXT DEFAULT '--'); INSERT INTO records VALUES ('SYNTHETIC_RECORD');",
    'migrations/002.sql': "CREATE TABLE records (label TEXT DEFAULT '/*'); INSERT INTO records VALUES ('SYNTHETIC_RECORD'); SELECT '*/';",
    'migrations/003.sql': "CREATE TABLE clean (label TEXT DEFAULT '--');",
  });
  try {
    const files = await f.context.files();
    expect(files.map(file => file.locator)).toEqual([{ kind: 'file', path: 'migrations/003.sql' }]);
    expect(await f.context.readText(files[0].locatorId)).not.toContain('SYNTHETIC_RECORD');
    const { bundle } = await f.extract();
    expect(bundle.inventorySummary).toMatchObject({ totalFiles: 3 + dialectInserts.length, eligibleFiles: 1, excludedFiles: 2 + dialectInserts.length, analyzedFiles: 1 });
    expect(bundle.inventorySummary.structural?.exclusions.secret_or_sensitive_data).toBe(2 + dialectInserts.length);
    expect(bundle.evidence.filter(e => e.structural?.kind === 'schema')).toHaveLength(1);
    expect(JSON.stringify(bundle)).not.toContain('SYNTHETIC_RECORD');
  } finally { await f.cleanup(); }
});

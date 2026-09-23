import { expect, it } from 'vitest';
import { containsSqlData } from '../../../src/domain/ingestion/exclusions';
import { extractionFixture } from '../../helpers/extraction-fixtures';

const quotedMarkers = ["'--'", "'/*'", "'it''s -- text'", '"--column"', '`/*column`', '[--column]', '$$--$$', '$marker$/*$marker$'];
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
    'schema.sql': "CREATE TABLE records (label TEXT DEFAULT '--'); INSERT INTO records VALUES ('SYNTHETIC_RECORD');",
    'migrations/002.sql': "CREATE TABLE records (label TEXT DEFAULT '/*'); INSERT INTO records VALUES ('SYNTHETIC_RECORD'); SELECT '*/';",
    'migrations/003.sql': "CREATE TABLE clean (label TEXT DEFAULT '--');",
  });
  try {
    const files = await f.context.files();
    expect(files.map(file => file.locator)).toEqual([{ kind: 'file', path: 'migrations/003.sql' }]);
    expect(await f.context.readText(files[0].locatorId)).not.toContain('SYNTHETIC_RECORD');
    const { bundle } = await f.extract();
    expect(bundle.inventorySummary).toMatchObject({ totalFiles: 3, eligibleFiles: 1, excludedFiles: 2, analyzedFiles: 1 });
    expect(bundle.inventorySummary.structural?.exclusions.secret_or_sensitive_data).toBe(2);
    expect(bundle.evidence.filter(e => e.structural?.kind === 'schema')).toHaveLength(1);
    expect(JSON.stringify(bundle)).not.toContain('SYNTHETIC_RECORD');
  } finally { await f.cleanup(); }
});

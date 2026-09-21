import pg from 'pg';
import { migrate, migrationPlan } from './migrations.mjs';

const args = new Set(process.argv.slice(2));
if ([...args].some(arg => !['--apply', '--adopt-existing'].includes(arg))) throw new Error('Usage: npm run db:migrate -- [--apply] [--adopt-existing]');
if (!args.has('--apply')) {
  for (const entry of await migrationPlan()) console.log(`${entry.path} ${entry.hash}`);
} else {
  if (!process.env.REPOFY_MIGRATION_DATABASE_URL) throw new Error('REPOFY_MIGRATION_DATABASE_URL is required; no application credentials are read');
  const client = new pg.Client({ connectionString: process.env.REPOFY_MIGRATION_DATABASE_URL });
  try {
    await client.connect();
    await migrate(client, { adoptExisting: args.has('--adopt-existing') });
    console.log('Migration plan applied.');
  } catch (error) {
    // Database errors may contain row values. Operational output is intentionally bounded.
    console.error(`Migration failed (${error.code ?? 'preflight'}). Inspect schema/ledger and docs/database.md; do not drop evidence data.`);
    process.exitCode = 1;
  } finally { await client.end(); }
}

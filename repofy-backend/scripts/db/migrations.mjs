import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
export async function migrationPlan({ feature = true } = {}) {
  const history = JSON.parse(await readFile(resolve(root, 'supabase/history.json'), 'utf8'));
  const rootFiles = await readdir(resolve(root, 'supabase/migrations'));
  const known = new Set(history.migrations.map(entry => entry.path));
  for (const name of rootFiles.filter(name => name.endsWith('.sql'))) {
    if (!known.has(`supabase/migrations/${name}`) && (!/^\d{14}_.*\.sql$/.test(name) || name < '20260913000000')) {
      throw new Error(`Unordered migration: ${name}`);
    }
  }
  for (const name of await readdir(resolve(root, 'repofy-backend/supabase/migrations'))) {
    const path = `repofy-backend/supabase/migrations/${name}`;
    if (!name.endsWith('.sql')) continue;
    if (history.omittedEmptyDuplicates.includes(path)) {
      if ((await readFile(resolve(root, path))).length) throw new Error(`Historical empty placeholder changed: ${path}`);
    } else if (!known.has(path)) throw new Error('New migrations must live in supabase/migrations');
  }
  const additions = feature ? rootFiles
    .filter(name => /^\d{14}_.*\.sql$/.test(name) && name >= '20260913000000')
    .sort().map(name => ({ path: `supabase/migrations/${name}` })) : [];
  return Promise.all([...history.migrations, ...additions].map(async entry => {
    const sql = await readFile(resolve(root, entry.path), 'utf8');
    const hash = createHash('sha256').update(sql).digest('hex');
    if (entry.sha256 && entry.sha256 !== hash) throw new Error(`Historical migration changed: ${entry.path}`);
    return { ...entry, hash, sql };
  }));
}

async function verifyExistingBaseline(db) {
  // Adoption is explicit: this checks the final historical schema, not a fabricated
  // record of which old files a deployment originally executed. See docs/database.md.
  for (const [table, columns] of Object.entries({
    profiles: ['id', 'username'], reports: ['user_id', 'report_data'], advice: ['advice_data', 'avatar_url'],
    credit_wallets: ['growth_balance', 'eval_balance'], credit_transactions: ['request_id', 'source'],
    api_usage: ['total_tokens'], analysis_cache: ['snapshot_hash'], github_tokens: ['github_user_id', 'github_token'],
    advice_jobs: ['request_id', 'user_id'], feedback: ['user_id', 'category'],
  })) {
    const { rows } = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`, [table]);
    if (columns.some(column => !rows.some(row => row.column_name === column))) throw new Error(`Baseline incomplete: ${table}`);
  }
  const { rows: [state] } = await db.query(`SELECT
    to_regclass('public.pending_signups') IS NULL AS pending_removed,
    to_regprocedure('public.grant_growth_credits(uuid,integer,text,jsonb)') IS NOT NULL AS credits_rpc,
    EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.reports'::regclass AND conname = 'reports_user_analyzed_unique') AS reports_unique,
    NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.advice'::regclass AND conname = 'advice_user_analyzed_unique') AS advice_multiple,
    EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_github_tokens_github_user_id') AS identity_index`);
  if (Object.values(state).some(value => value !== true)) throw new Error('Baseline incomplete: historical postconditions');
  await verifyAdviceFk(db, true);
}

async function verifyAdviceFk(db, required = false) {
  const { rows } = await db.query(`SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint
    WHERE conrelid = 'public.advice_jobs'::regclass AND conname = 'advice_jobs_user_id_fkey'`);
  if (rows.length && rows[0].definition !== 'FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE') {
    throw new Error('Historical advice_jobs FK differs; a forward repair is required');
  }
  if (required && !rows.length) throw new Error('Baseline incomplete: advice_jobs user FK');
  return rows.length > 0;
}

export async function migrate(db, { feature = true, adoptExisting = false } = {}) {
  const plan = await migrationPlan({ feature });
  // Historical migrations contain unqualified names; always create them in public.
  await db.query('SET search_path TO public');
  await db.query('SELECT pg_advisory_lock(826402, 2)');
  try {
    await db.query(`CREATE SCHEMA IF NOT EXISTS repofy_migrations;
      REVOKE ALL ON SCHEMA repofy_migrations FROM PUBLIC, anon, authenticated, service_role;
      CREATE TABLE IF NOT EXISTS repofy_migrations.applied (
        path text PRIMARY KEY, sha256 text NOT NULL, disposition text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now());`);
    const { rows: done } = await db.query('SELECT * FROM repofy_migrations.applied');
    const applied = new Map(done.map(row => [row.path, row]));
    if (!applied.size) {
      const { rows: [existing] } = await db.query("SELECT to_regclass('public.profiles') IS NOT NULL AS present");
      if (existing.present && !adoptExisting) throw new Error('Existing schema has no Repofy ledger; review the baseline and use --adopt-existing');
      if (adoptExisting) await verifyExistingBaseline(db);
    } else if (adoptExisting) throw new Error('Adoption requires an empty migration ledger');
    for (const entry of plan) {
      if (applied.has(entry.path)) {
        if (applied.get(entry.path).sha256 !== entry.hash) throw new Error(`Applied migration changed: ${entry.path}`);
        continue;
      }
      await db.query('BEGIN');
      try {
        let disposition = 'applied';
        if (adoptExisting && entry.sha256) disposition = 'adopted-existing';
        else if (entry.path.endsWith('20260321200000_add_advice_jobs_user_fk.sql') && await verifyAdviceFk(db)) disposition = 'verified-redundant';
        else await db.query(entry.sql);
        await db.query('INSERT INTO repofy_migrations.applied(path, sha256, disposition) VALUES ($1, $2, $3)', [entry.path, entry.hash, disposition]);
        await db.query('COMMIT');
      } catch (error) { await db.query('ROLLBACK'); throw error; }
    }
  } finally { await db.query('SELECT pg_advisory_unlock(826402, 2)'); }
}

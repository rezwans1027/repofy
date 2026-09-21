import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import type { FeatureOneRpcClient } from "../../src/domain/analysis/persistence";

/** Local disposable PostgreSQL WASM fixture; no application .env/database is read. */
export async function selectionDatabase() {
  const db = new PGlite();
  await db.exec(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE TABLE auth.sessions(id uuid PRIMARY KEY, user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT 'service_role'::text $$;
    CREATE TABLE public.api_usage(id uuid PRIMARY KEY);
    CREATE TABLE public.github_tokens(user_id uuid PRIMARY KEY REFERENCES auth.users(id), github_user_id bigint);
    GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;`);
  const directory = resolve(__dirname, '../../../supabase/migrations');
  for (const name of (await readdir(directory)).filter(name => name >= '20260913000000' && name.endsWith('.sql')).sort()) {
    await db.exec(await readFile(resolve(directory, name), 'utf8'));
  }
  // Named arguments keep this fixture coupled to the real RPC signatures, not a policy double.
  const rpc: FeatureOneRpcClient = { async rpc(name, args) {
    if (!/^feature_one_[a-z0-9_]+$/.test(name) || Object.keys(args).some(key => !/^p_[a-z_]+$/.test(key))) throw new Error('Invalid fixture RPC');
    try {
      const keys = Object.keys(args);
      const result = await db.query<{ data: unknown }>(`SELECT public.${name}(${keys.map((key, i) => `${key} => $${i + 1}`).join(',')}) AS data`,
        keys.map(key => key === 'p_items' || key === 'p_files' || key === 'p_resolutions' || (key === 'p_repositories' && name.endsWith('_discover')) ? JSON.stringify(args[key]) : args[key]));
      return { data: result.rows[0].data, error: null };
    } catch (error) { return { data: null, error: { message: (error as Error).message } }; }
  } };
  return { db, rpc };
}

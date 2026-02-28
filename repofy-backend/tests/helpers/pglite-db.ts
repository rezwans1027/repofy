import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "fs";
import { resolve } from "path";

const MIGRATION_DIR = resolve(__dirname, "../../../supabase/migrations");

/**
 * Spin up an in-memory PGlite instance with the auth stubs,
 * profiles table, and the full 005_credit_wallets migration applied.
 */
export async function createCreditTestDb(): Promise<PGlite> {
  const db = new PGlite();

  // Supabase role stubs (required by REVOKE/GRANT in migration)
  await db.exec(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN;
      END IF;
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN;
      END IF;
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role NOLOGIN;
      END IF;
    END $$;
  `);

  // Supabase auth stubs (required by RLS policies / FK on profiles)
  await db.exec(`
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid
      LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
  `);

  // Minimal profiles table — FK target for credit_wallets / credit_transactions
  await db.exec(`
    CREATE TABLE public.profiles (
      id uuid PRIMARY KEY,
      username text,
      display_name text,
      avatar_url text,
      created_at timestamptz DEFAULT now() NOT NULL,
      updated_at timestamptz DEFAULT now() NOT NULL
    );
  `);

  // Apply the real migration
  const migrationSql = readFileSync(
    resolve(MIGRATION_DIR, "005_credit_wallets.sql"),
    "utf-8",
  );
  await db.exec(migrationSql);

  return db;
}

export async function createTestProfile(
  db: PGlite,
  userId: string,
): Promise<void> {
  await db.query(
    "INSERT INTO profiles (id, username) VALUES ($1, $2) ON CONFLICT DO NOTHING",
    [userId, `test-${userId.slice(0, 8)}`],
  );
}

export async function getWalletBalance(
  db: PGlite,
  userId: string,
): Promise<number> {
  const result = await db.query<{ growth_balance: number }>(
    "SELECT growth_balance FROM credit_wallets WHERE user_id = $1",
    [userId],
  );
  return result.rows[0]?.growth_balance ?? 0;
}

export async function getTransactionCount(
  db: PGlite,
  userId: string,
  source?: string,
): Promise<number> {
  if (source) {
    const r = await db.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM credit_transactions WHERE user_id = $1 AND source = $2",
      [userId, source],
    );
    return parseInt(r.rows[0].count, 10);
  }
  const r = await db.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM credit_transactions WHERE user_id = $1",
    [userId],
  );
  return parseInt(r.rows[0].count, 10);
}

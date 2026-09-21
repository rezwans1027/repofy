import { execFileSync, spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import pg from 'pg';

// Always create/drop only a random test database. Never load application .env files.
const database = `repofy_feature_test_${randomBytes(8).toString('hex')}`;
let directory; let bindir; let started = false; let admin;
try {
  let config;
  if (process.env.TEST_PG_ADMIN_URL) {
    const url = new URL(process.env.TEST_PG_ADMIN_URL);
    if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('PostgreSQL tests require a loopback test server');
    config = { connectionString: url.toString() };
  } else {
    bindir = process.env.PG_BINDIR;
    if (!bindir && existsSync('/opt/homebrew/opt/postgresql@17/bin/initdb')) bindir = '/opt/homebrew/opt/postgresql@17/bin';
    if (!bindir) {
      try { bindir = execFileSync('pg_config', ['--bindir'], { encoding: 'utf8' }).trim(); }
      catch { throw new Error('Install PostgreSQL 17 and set PG_BINDIR, or set TEST_PG_ADMIN_URL for a local disposable server'); }
    }
    directory = await mkdtemp(join(tmpdir(), 'repofy-pg-'));
    const socket = join(directory, 'socket'); await mkdir(socket);
    execFileSync(join(bindir, 'initdb'), ['-D', join(directory, 'data'), '-U', 'postgres', '-A', 'trust', '--no-locale', '-E', 'UTF8'], { stdio: 'ignore' });
    execFileSync(join(bindir, 'pg_ctl'), ['-D', join(directory, 'data'), '-l', join(directory, 'postgres.log'), '-o', `-k ${socket} -h '' -F`, '-w', 'start'], { stdio: 'ignore' });
    started = true;
    config = { host: socket, user: 'postgres', database: 'postgres' };
  }
  admin = new pg.Client(config); await admin.connect();
  await admin.query(`CREATE DATABASE ${database}`);
  const testConfig = config.connectionString
    ? { connectionString: (() => { const url = new URL(config.connectionString); url.pathname = `/${database}`; return url.toString(); })() }
    : { ...config, database };
  const child = spawn(process.execPath, process.argv.includes('--readiness-e2e')
    ? ['--import', 'tsx', 'tests/e2e/readiness-server.ts']
    : ['--import', 'tsx', '--test', '--test-concurrency=1', 'tests/postgres/feature-one.test.ts'], {
    stdio: 'inherit', env: { ...process.env, REPOFY_PG_TEST_CONFIG: JSON.stringify(testConfig) },
  });
  // The browser harness also owns an ephemeral database. Forward shutdown so
  // its connections close before the database and temporary cluster are removed.
  for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => child.kill(signal));
  process.exitCode = await new Promise((resolve, reject) => { child.on('error', reject); child.on('exit', code => resolve(code ?? 1)); });
} finally {
  if (admin) { await admin.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`); await admin.end(); }
  if (started) execFileSync(join(bindir, 'pg_ctl'), ['-D', join(directory, 'data'), '-m', 'immediate', '-w', 'stop'], { stdio: 'ignore' });
  if (directory) await rm(directory, { recursive: true, force: true });
}

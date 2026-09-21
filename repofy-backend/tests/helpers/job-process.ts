import pg from "pg";
import { jobsRpc } from "../postgres/jobs.cases";
import { JobRepository } from "../../src/domain/jobs/repository";
if (!process.env.REPOFY_PG_TEST_CONFIG || !process.send) throw new Error("Disposable PostgreSQL test process only");
const db = new pg.Client(JSON.parse(process.env.REPOFY_PG_TEST_CONFIG));
void (async () => {
  await db.connect(); const claim = await new JobRepository(jobsRpc(db)).claim(); process.send!({ claim });
  // The parent deliberately SIGKILLs the winning claimant before graceful
  // connection shutdown. Only this checked-in test process supports this mode.
  if (claim && process.argv.includes('--hold-for-kill')) await new Promise(() => {});
  await db.end(); process.disconnect();
})().catch(() => { process.exitCode = 1; process.disconnect(); });

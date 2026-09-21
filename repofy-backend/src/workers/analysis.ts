import { suppressTracing } from "@sentry/node";
import { getSupabaseAdmin } from "../config/supabase";
import { analysisWorker, jobRepository, workspaceManager } from "../domain/jobs/runtime";
import { maintenance, schedule } from "../domain/jobs/scheduler";
import { logger } from "../lib/logger";

const shutdown = new AbortController();
let shutdownDeadline: NodeJS.Timeout | undefined;
for (const signal of ["SIGTERM", "SIGINT"] as const) process.once(signal, () => {
  shutdown.abort();
  // A hung native parser/handler cannot retain a workspace indefinitely. Supervisor restarts.
  shutdownDeadline = setTimeout(() => process.exit(70), 10000); shutdownDeadline.unref();
});
const fail = () => logger.warn("Analysis worker operation failed", { code: "DATABASE_FAILURE" });
async function main() {
  const jobs = jobRepository(); const db = getSupabaseAdmin(); const workspaces = workspaceManager();
  if (process.argv.includes("--maintenance")) {
    await schedule(async () => {
      const result = await suppressTracing(() => maintenance(jobs, workspaces, db));
      if (result.failed) fail();
    }, 30000, shutdown.signal, fail);
  } else {
    // Startup cleanup precedes claiming. A separate maintenance process must run on this volume.
    await suppressTracing(() => maintenance(jobs, workspaces, db));
    const worker = analysisWorker();
    await schedule(async () => {
      process.send?.("working");
      const hardDeadline = setTimeout(() => process.exit(70), 16 * 60 * 1000); hardDeadline.unref();
      try { await suppressTracing(() => worker.once(shutdown.signal)); }
      finally { clearTimeout(hardDeadline); process.send?.("idle"); }
    }, 2000, shutdown.signal, fail);
  }
}
void main().catch(() => { fail(); process.exitCode = 1; }).finally(() => {
  clearTimeout(shutdownDeadline);
  if (process.connected) process.disconnect?.();
});

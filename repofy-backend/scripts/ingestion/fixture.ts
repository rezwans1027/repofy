/** Separate-process synthetic driver. Never loads app .env, real source, or credentials. */
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { SnapshotIngestionService } from "../../src/domain/ingestion/service";
import { WorkspaceManager } from "../../src/domain/ingestion/workspace";
import { MAX_WORKSPACE_AGE_MS } from "../../src/domain/ingestion/policy";
import { archiveFixture, MemoryIngestionStore, SyntheticSnapshotSource } from "../../tests/helpers/ingestion-fixtures";
import { fixtureCrypto } from "../../tests/helpers/evidence-fixtures";

async function main() {
  const mode = process.argv[2];
  if (mode === "--crash") {
    const workspace = await new WorkspaceManager(process.argv[3]).create(randomUUID(), randomUUID());
    await writeFile(workspace.archive, archiveFixture(), { mode: 0o600 });
    process.exit(23); // Simulated abrupt termination: deliberately bypasses finally.
  }
  if (mode === "--sweep") {
    const result = await new WorkspaceManager(process.argv[3], () => Date.now() + MAX_WORKSPACE_AGE_MS + 1000).sweep();
    process.stdout.write(JSON.stringify(result) + "\n"); return;
  }
  const root = await mkdtemp(join(tmpdir(), "repofy-ingestion-driver-"));
  try {
    const store = new MemoryIngestionStore(); const source = new SyntheticSnapshotSource(store, archiveFixture([
      { path: "fixture-root/src/synthetic.ts", body: "export const add = (a: number, b: number) => a + b;\n" },
      { path: "fixture-root/package.json", body: JSON.stringify({ scripts: { install: "DO_NOT_EXECUTE_REPOSITORY_INSTRUCTIONS" } }) },
      { path: "fixture-root/unusual.txt", body: "ghp_" + "A7".repeat(20) },
      { path: "fixture-root/.env", body: "NEVER_EXPOSE_SOURCE_SENTINEL" },
    ]));
    const ingestion = new SnapshotIngestionService(store, source, fixtureCrypto(), new WorkspaceManager(root));
    let eligibleFiles = 0;
    await ingestion.withSafeSnapshot(store.request, async context => {
      eligibleFiles = (await context.files()).length;
      for (const file of await context.files()) {
        if ((await context.readText(file.locatorId)).includes("NEVER_EXPOSE_SOURCE_SENTINEL")) throw new Error("Privacy check failed");
      }
    });
    if ((await readdir(root)).length || ![...store.attempts.values()].every(a => a.disposed)) throw new Error("Cleanup check failed");
    process.stdout.write(JSON.stringify({ eligibleFiles, cleanup: "passed", repositoryExecution: "none" }) + "\n");
  } finally { await rm(root, { recursive: true, force: true }); }
}
main().catch(() => { process.stderr.write("Synthetic ingestion verification failed\n"); process.exitCode = 1; });

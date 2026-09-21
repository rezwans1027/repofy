import { constants } from "node:fs";
import { lstat, mkdir, open, readdir, realpath, rm } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { z } from "zod";
import { IngestionError } from "./errors";
import { MAX_WORKSPACE_AGE_MS } from "./policy";

const manifestSchema = z.strictObject({ version: z.literal(1), workspaceId: z.uuid(), jobId: z.uuid(),
  createdAt: z.number().int().nonnegative(), deadline: z.number().int().nonnegative() });
export type WorkspaceManifest = z.infer<typeof manifestSchema>;
/** One private local volume per worker host. Janitor needs no intake flag or provider secrets. */
export class WorkspaceManager {
  constructor(readonly root = join(tmpdir(), `repofy-ingestion-${process.getuid?.() ?? "worker"}`), private readonly now: () => number = Date.now) {}
  private async initialize() {
    if (!isAbsolute(this.root) || resolve(this.root) !== this.root || this.root === "/" || this.root.split("/").some(p => ["public", "static", "node_modules", ".git"].includes(p))) throw new IngestionError("WORKSPACE_FAILURE");
    try { await mkdir(this.root, { mode: 0o700 }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw new IngestionError("WORKSPACE_FAILURE"); }
    const stat = await lstat(this.root);
    if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o077) || (process.getuid && stat.uid !== process.getuid())) throw new IngestionError("WORKSPACE_FAILURE");
    const canonical = await realpath(this.root);
    if (canonical.split("/").some(p => ["public", "static", "node_modules", ".git"].includes(p))) throw new IngestionError("WORKSPACE_FAILURE");
    return canonical;
  }
  async create(workspaceId: string, jobId: string): Promise<{ archive: string; manifest: WorkspaceManifest }> {
    try {
      z.uuid().parse(workspaceId); z.uuid().parse(jobId);
      const root = await this.initialize(); const directory = join(root, workspaceId);
      await mkdir(directory, { mode: 0o700 }); // Exclusive: no reuse, including an existing attempt directory.
      try {
        const manifest = manifestSchema.parse({ version: 1, workspaceId, jobId, createdAt: this.now(), deadline: this.now() + MAX_WORKSPACE_AGE_MS });
        const file = await open(join(directory, "manifest.json"), constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
        try { await file.writeFile(JSON.stringify(manifest)); await file.sync(); } finally { await file.close(); }
        return { archive: join(directory, "archive.tgz"), manifest };
      } catch { await rm(directory, { recursive: true, force: true }); throw new IngestionError("WORKSPACE_FAILURE"); }
    } catch { throw new IngestionError("WORKSPACE_FAILURE"); }
  }
  async dispose(workspaceId: string): Promise<void> {
    try { z.uuid().parse(workspaceId); const root = await this.initialize(); await rm(join(root, workspaceId), { recursive: true, force: true }); }
    catch { throw new IngestionError("WORKSPACE_FAILURE"); }
  }
  /** Run at startup and every <=5 minutes. Optional DB callback must atomically
   * fence an expired attempt before returning true; DB outages still permit the
   * absolute 30-minute disk TTL. No renewal may extend that absolute deadline. */
  async sweep(claimExpired?: (workspaceId: string) => Promise<boolean>): Promise<{ removed: number; failed: number }> {
    const root = await this.initialize(); let removed = 0; let failed = 0;
    for (const entry of await readdir(root, { withFileTypes: true })) {
      if (!z.uuid().safeParse(entry.name).success) continue;
      const directory = join(root, entry.name);
      try {
        const stat = await lstat(directory); let expired = this.now() - stat.mtimeMs >= MAX_WORKSPACE_AGE_MS;
        if (stat.isSymbolicLink() || !stat.isDirectory()) { await rm(directory, { force: true }); removed++; continue; }
        try {
          const file = await open(join(directory, "manifest.json"), constants.O_RDONLY | constants.O_NOFOLLOW);
          try {
            if ((await file.stat()).size > 1024) throw new Error();
            const manifest = manifestSchema.parse(JSON.parse(await file.readFile("utf8")));
            if (manifest.workspaceId !== entry.name) throw new Error();
            expired ||= this.now() >= Math.min(manifest.deadline, manifest.createdAt + MAX_WORKSPACE_AGE_MS);
          } finally { await file.close(); }
        } catch { /* Incomplete creation: directory mtime supplies the same bounded TTL. */ }
        if (!expired && claimExpired) { try { expired = await claimExpired(entry.name); } catch { /* Retry next sweep, absolute TTL remains effective. */ } }
        if (expired) { await rm(directory, { recursive: true, force: true }); removed++; }
      } catch { failed++; }
    }
    return { removed, failed };
  }
}

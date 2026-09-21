import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { z } from "zod";
import { Login, RepoName, type InstallationCredential } from "../github-app/provider";
import { GitHubCommitShaSchema } from "@repofy/contracts";
import { checkSignal, IngestionError, safeError } from "./errors";

/** Only server-verified repository coordinates and an exact SHA are accepted.
 * Redirect URLs are temporary credentials too: never return, persist or log them. */
export class GitHubArchiveClient {
  constructor(private readonly fetcher: typeof fetch = fetch) {}
  async download(repository: { owner: string; name: string; commitSha: string }, credential: InstallationCredential,
    destination: string, maxBytes: number, signal: AbortSignal, checkpoint: () => Promise<void>): Promise<number> {
    let response: Response | undefined;
    try {
      const parsed = z.strictObject({ owner: Login, name: RepoName, commitSha: GitHubCommitShaSchema }).safeParse(repository);
      if (!parsed.success) throw new IngestionError("INVALID_REQUEST");
      const { owner, name, commitSha } = parsed.data;
      let url = new URL(`https://api.github.com/repos/${owner}/${name}/tarball/${commitSha}`);
      const allowedPath = `/${owner}/${name}/legacy.tar.gz/${commitSha}`;
      for (let redirects = 0; ; redirects++) {
        checkSignal(signal); await checkpoint(); credential.assertValid();
        response = await this.fetcher(url, { redirect: "manual", signal, credentials: "omit",
          headers: { Accept: "application/vnd.github+json", "Accept-Encoding": "identity", "Cache-Control": "no-store", "User-Agent": "Repofy",
            ...(url.hostname === "api.github.com" ? { Authorization: `Bearer ${credential.token}`, "X-GitHub-Api-Version": "2026-03-10" } : {}) } });
        if (![301, 302, 303, 307, 308].includes(response.status)) break;
        const location = response.headers.get("location"); await response.body?.cancel();
        if (redirects >= 2 || !location || location.length > 4096) throw new IngestionError("UNSAFE_REDIRECT");
        let next: URL; try { next = new URL(location); } catch { throw new IngestionError("UNSAFE_REDIRECT"); }
        if (next.protocol !== "https:" || next.hostname !== "codeload.github.com" || next.port || next.username || next.password || next.hash
          || next.pathname.toLowerCase() !== allowedPath.toLowerCase() || [...next.searchParams.keys()].some(key => key !== "token")) throw new IngestionError("UNSAFE_REDIRECT");
        url = next;
      }
      if ([401, 403, 404].includes(response.status) && response.headers.get("x-ratelimit-remaining") !== "0" && !response.headers.has("retry-after")) throw new IngestionError("ACCESS_REVOKED");
      if (response.status !== 200 || !response.body) throw new IngestionError("PROVIDER_FAILURE");
      if (response.headers.has("content-encoding") && response.headers.get("content-encoding") !== "identity") throw new IngestionError("ARCHIVE_INVALID");
      const declared = response.headers.get("content-length");
      if (declared && (!/^\d+$/.test(declared) || Number(declared) > maxBytes)) throw new IngestionError("ARCHIVE_LIMIT");
      const reader = response.body.getReader(); let bytes = 0;
      // Abort the reader even when a synthetic/custom transport ignores AbortSignal.
      const abort = () => { void reader.cancel().catch(() => undefined); };
      signal.addEventListener("abort", abort, { once: true });
      try {
        const file = await open(destination, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600)
          .catch(() => { throw new IngestionError("WORKSPACE_FAILURE"); });
        try {
          while (true) {
            checkSignal(signal); const chunk = await reader.read(); checkSignal(signal);
            if (chunk.done) break;
            bytes += chunk.value.length;
            if (bytes > maxBytes) throw new IngestionError("ARCHIVE_LIMIT");
            credential.assertValid();
            await file.writeFile(chunk.value).catch(() => { throw new IngestionError("WORKSPACE_FAILURE"); });
          }
          await file.sync().catch(() => { throw new IngestionError("WORKSPACE_FAILURE"); });
        } finally { await file.close(); }
        if (bytes === 0 || (declared !== null && bytes !== Number(declared))) throw new IngestionError("ARCHIVE_INVALID");
        await checkpoint(); checkSignal(signal); return bytes;
      } finally { signal.removeEventListener("abort", abort); await reader.cancel().catch(() => undefined); reader.releaseLock(); }
    } catch (error) {
      if (!response?.body?.locked) await response?.body?.cancel().catch(() => undefined);
      checkSignal(signal); throw safeError(error);
    }
  }
}

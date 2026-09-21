import { z } from "zod";
import { GitHubCommitShaSchema, TimestampSchema, type StructuralObservation } from "@repofy/contracts";
import { GitHubAppError } from "./errors";
import { Login, ProviderId, RepoName, type InstallationCredential, type ReadPermission } from "./provider";
import type { GitHubConnectionService } from "./service";
import type { PinnedSnapshot } from "../ingestion/repository";
import { IngestionError, checkSignal } from "../ingestion/errors";
import { EXTRACTION_LIMITS as LIMIT } from "../extraction/policy";
import { boundedTree } from "../extraction/parsers";
import { emptyMetadata, MetadataBatchSchema, METADATA_SOURCES, providerDetail, requested,
  type MetadataBatch, type MetadataOptions, type MetadataSource, type MetadataState } from "../extraction/metadata";

class MetadataError extends Error { constructor(readonly state: MetadataState) { super(state); } }
const actorSchema = z.object({ id: ProviderId, type: z.enum(["User", "Bot"]).optional() }).nullable();
const iso = z.string().datetime({ offset: true }).transform(value => new Date(value).toISOString());
const conclusion = z.enum(["success", "failure", "neutral", "cancelled", "skipped", "timed_out", "action_required", "stale", "startup_failure"]);
const parse = <T>(schema: z.ZodType<T>, input: unknown): T => {
  const result = schema.safeParse(input); if (!result.success) throw new MetadataError("parse_failure"); return result.data;
};
type Scope = { owner: string; name: string; sha: string; repositoryId: string; identityId: string };
type RecordValue = MetadataBatch["groups"][number]["records"][number];

/** Only fixed GitHub REST paths, selected-repository installation tokens and bounded bodies.
 * Fetch and clock injection are test seams; neither is selected by repository or HTTP inputs. */
export class GitHubMetadataClient {
  constructor(private readonly fetcher: typeof fetch = fetch, private readonly now: () => number = Date.now) {}
  private async request(path: string, credential: InstallationCredential, signal: AbortSignal) {
    credential.assertValid(); checkSignal(signal);
    try {
      const response = await this.fetcher(`https://api.github.com${path}`, { redirect: "manual", credentials: "omit", signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
        headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${credential.token}`, "User-Agent": "Repofy", "X-GitHub-Api-Version": "2026-03-10" } });
      if (!response.ok) { await response.body?.cancel(); throw new MetadataError(response.status === 403 && response.headers.get("x-ratelimit-remaining") !== "0" && !response.headers.has("retry-after")
        || response.status === 404 ? "permission_denied" : "provider_unavailable"); }
      if (Number(response.headers.get("content-length")) > LIMIT.metadataBytes) { await response.body?.cancel(); throw new MetadataError("processing_limit"); }
      const reader = response.body?.getReader(); if (!reader) throw new MetadataError("provider_unavailable");
      const chunks: Uint8Array[] = []; let size = 0;
      try {
        while (true) {
          const chunk = await reader.read(); checkSignal(signal); if (chunk.done) break;
          size += chunk.value.length; if (size > LIMIT.metadataBytes) throw new MetadataError("processing_limit"); chunks.push(chunk.value);
        }
      } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
      credential.assertValid();
      let data: unknown;
      try { data = boundedTree(JSON.parse(Buffer.concat(chunks).toString("utf8"))); } catch { throw new MetadataError("parse_failure"); }
      return { data, hasNext: /rel="next"/.test(response.headers.get("link") ?? "") };
    } catch (error) { checkSignal(signal); if (error instanceof MetadataError || error instanceof GitHubAppError) throw error; throw new MetadataError("provider_unavailable"); }
  }
  async collect(source: MetadataSource, scope: Scope, credential: InstallationCredential, signal: AbortSignal, checkpoint: () => Promise<void>) {
    const base = `/repos/${encodeURIComponent(parse(Login, scope.owner))}/${encodeURIComponent(parse(RepoName, scope.name))}`;
    const sha = parse(GitHubCommitShaSchema, scope.sha); const records = new Map<string, RecordValue>(); let truncated = false;
    const retrievedAt = new Date(this.now()).toISOString();
    for (let page = 1; page <= LIMIT.metadataPages; page++) {
      await checkpoint(); checkSignal(signal);
      const pagination = `per_page=${LIMIT.metadataPageSize}&page=${page}`;
      const paths: Record<MetadataSource, string> = { commits: `/commits?sha=${sha}&${pagination}`, pullRequests: `/commits/${sha}/pulls?${pagination}`,
        checks: `/commits/${sha}/check-runs?filter=all&${pagination}`, statuses: `/commits/${sha}/status?${pagination}`,
        actions: `/actions/runs?head_sha=${sha}&${pagination}` };
      const response = await this.request(base + paths[source], credential, signal); await checkpoint();
      let raw: unknown[]; let total = 0; let statusSha: string | undefined;
      if (source === "commits" || source === "pullRequests") raw = parse(z.array(z.unknown()).max(LIMIT.metadataPageSize), response.data);
      else {
        const field = source === "checks" ? "check_runs" : source === "actions" ? "workflow_runs" : "statuses";
        const doc = parse(z.object({ [field]: z.array(z.unknown()).max(LIMIT.metadataPageSize), total_count: z.number().int().nonnegative(),
          ...(source === "statuses" ? { sha: GitHubCommitShaSchema } : {}) }), response.data);
        raw = (doc as Record<string, unknown>)[field] as unknown[]; total = doc.total_count; statusSha = doc.sha as string | undefined;
      }
      for (const item of raw) {
        const record = this.normalize(source, item, scope, retrievedAt, statusSha);
        if (!records.has(record.objectId)) records.set(record.objectId, record);
      }
      truncated = response.hasNext || page * LIMIT.metadataPageSize < total;
      if (!truncated) break;
    }
    const values = [...records.values()].sort((a, b) => a.objectId < b.objectId ? -1 : a.objectId > b.objectId ? 1 : 0);
    return { coverage: { source, state: truncated ? "truncated" as const : values.length ? "available" as const : "no_signal" as const,
      records: values.length, exactCommitRecords: values.filter(v => v.detail.provider!.relationship === "exact_commit").length, retrievedAt }, records: values };
  }
  private normalize(source: MetadataSource, input: unknown, scope: Scope, retrievedAt: string, statusSha?: string): RecordValue {
    let id: string; let sha: string | undefined; let occurredAt: string | undefined; let author: z.infer<typeof actorSchema> = null;
    let result: NonNullable<StructuralObservation["provider"]>["result"] = "unknown"; let counts = {};
    const kinds = { commits: "commit", pullRequests: "pull_request", checks: "check", statuses: "status", actions: "action" } as const;
    if (source === "commits") {
      const row = parse(z.object({ sha: GitHubCommitShaSchema, author: actorSchema, commit: z.object({ author: z.object({ date: iso }).nullable() }),
        parents: z.array(z.object({ sha: GitHubCommitShaSchema })).max(100) }), input);
      id = row.sha; sha = row.sha; author = row.author; occurredAt = row.commit.author?.date; counts = { parents: row.parents.length };
    } else if (source === "pullRequests") {
      const row = parse(z.object({ id: ProviderId, state: z.enum(["open", "closed"]), merged_at: iso.nullable(), updated_at: iso, user: actorSchema,
        merge_commit_sha: GitHubCommitShaSchema.nullable(), head: z.object({ sha: GitHubCommitShaSchema, repo: z.object({ id: ProviderId }).nullable() }) }), input);
      id = row.id; sha = row.merge_commit_sha === scope.sha && row.merged_at ? scope.sha : row.head.repo?.id === scope.repositoryId ? row.head.sha : row.merged_at ? row.merge_commit_sha ?? undefined : undefined;
      author = row.user; occurredAt = row.updated_at; result = row.merged_at ? "merged" : row.state;
    } else if (source === "statuses") {
      const row = parse(z.object({ id: ProviderId, state: z.enum(["error", "failure", "pending", "success"]), created_at: iso, creator: actorSchema }), input);
      id = row.id; sha = statusSha; occurredAt = row.created_at; author = row.creator; result = row.state === "error" ? "failure" : row.state;
    } else {
      const row = parse(z.object({ id: ProviderId, head_sha: GitHubCommitShaSchema, status: z.string().max(40), conclusion: conclusion.nullable() }), input);
      if (source === "checks") occurredAt = parse(z.object({ started_at: iso.nullable() }), input).started_at ?? undefined;
      else {
        const action = parse(z.object({ created_at: iso, actor: actorSchema, repository: z.object({ id: ProviderId }) }), input);
        if (action.repository.id !== scope.repositoryId) throw new MetadataError("parse_failure");
        occurredAt = action.created_at; author = action.actor;
      }
      id = row.id; sha = row.head_sha;
      result = row.status === "completed" ? row.conclusion ?? "unknown" : ["queued", "in_progress", "pending"].includes(row.status) ? row.status as typeof result : "unknown";
    }
    return { objectId: `${source}_${id}`, detail: providerDetail(kinds[source], { retrievedAt, subjectSha: sha,
      relationship: sha === scope.sha ? "exact_commit" : source === "commits" ? "ancestor" : "repository_context",
      ...(occurredAt ? { occurredAt: parse(TimestampSchema, occurredAt) } : {}), result,
      authorMatch: !author ? "unavailable" : author.id === scope.identityId ? "connected_identity" : "other_identity", authorType: author?.type ?? "unknown" }, counts) };
  }
}

export class AuthorizedMetadataSource {
  constructor(private readonly github: GitHubConnectionService, private readonly client = new GitHubMetadataClient()) {}
  async collect(actor: string, pin: Readonly<PinnedSnapshot>, options: MetadataOptions, signal: AbortSignal, checkpoint: () => Promise<void>): Promise<MetadataBatch> {
    const batch = emptyMetadata(pin.repositoryId, pin.commitSha, options);
    const permissions: Record<MetadataSource, ReadPermission> = { commits: "contents", pullRequests: "pull_requests", checks: "checks", statuses: "statuses", actions: "actions" };
    for (const source of METADATA_SOURCES) {
      if (!requested(source, options)) continue;
      await checkpoint(); checkSignal(signal);
      let group: MetadataBatch["groups"][number];
      try {
        group = await this.github.withVerifiedRepositoryToken(actor, pin.accountId, pin.installationId, pin.repositoryId, [permissions[source]], async (credential, repo, identity) => {
          if (repo.id !== pin.providerRepositoryId || (repo.private ? "private" : "public") !== pin.repositoryVisibility || repo.archived) throw new IngestionError("ACCESS_REVOKED");
          return this.client.collect(source, { owner: repo.owner.login, name: repo.name, sha: pin.commitSha, repositoryId: repo.id, identityId: identity.id }, credential, signal, checkpoint);
        });
      } catch (error) {
        checkSignal(signal);
        if (error instanceof IngestionError || (error instanceof Error && "code" in error && ["LEASE_LOST", "DATABASE_FAILURE", "REPOSITORY_ACCESS_REVOKED"].includes(error.code as string))) throw error;
        if (error instanceof GitHubAppError && ["access_changed", "reconnect_required", "identity_conflict", "installation_missing", "installation_suspended", "not_found"].includes(error.code)) throw new IngestionError("ACCESS_REVOKED");
        if (error instanceof GitHubAppError && error.code === "database_failure") throw new IngestionError("DATABASE_FAILURE");
        group = { coverage: { source, state: error instanceof MetadataError ? error.state : error instanceof GitHubAppError && error.code === "insufficient_permissions" ? "permission_denied" : "provider_unavailable",
          records: 0, exactCommitRecords: 0, retrievedAt: new Date().toISOString() }, records: [] };
      }
      await checkpoint(); batch.groups[METADATA_SOURCES.indexOf(source)] = group;
    }
    return MetadataBatchSchema.parse(batch);
  }
}

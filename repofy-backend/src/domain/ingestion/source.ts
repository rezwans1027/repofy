import type { GitHubConnectionService } from "../github-app/service";
import { GitHubAppError } from "../github-app/errors";
import type { IngestionAccess, IngestionRequest, PinnedSnapshot } from "./repository";
import { GitHubArchiveClient } from "./github-archive";
import { IngestionError, safeError } from "./errors";

function sourceError(error: unknown) {
  if (error instanceof GitHubAppError && ["reconnect_required", "identity_conflict", "installation_missing", "installation_suspended",
    "pending_approval", "insufficient_permissions", "access_changed", "not_found"].includes(error.code)) return new IngestionError("ACCESS_REVOKED");
  return safeError(error);
}

export interface SnapshotSource {
  resolve(request: IngestionRequest, access: IngestionAccess): Promise<Pick<PinnedSnapshot, "providerRepositoryId" | "branch" | "commitSha" | "repositoryVisibility">>;
  download(request: IngestionRequest, pin: PinnedSnapshot, destination: string, signal: AbortSignal, checkpoint: () => Promise<void>): Promise<void>;
}
export class GitHubSnapshotSource implements SnapshotSource {
  constructor(private readonly github: GitHubConnectionService, private readonly archive = new GitHubArchiveClient()) {}
  async resolve(request: IngestionRequest, access: IngestionAccess) {
    try { return await this.github.resolveDefaultCommit(request.actor, access.accountId, access.installationId, request.repositoryId); }
    catch (error) { throw sourceError(error); }
  }
  async download(request: IngestionRequest, pin: PinnedSnapshot, destination: string, signal: AbortSignal, checkpoint: () => Promise<void>) {
    await checkpoint();
    await this.github.withVerifiedRepositoryToken(request.actor, pin.accountId, pin.installationId, pin.repositoryId, ["contents"], async (credential, item) => {
      if (item.id !== pin.providerRepositoryId || (item.private ? "private" : "public") !== pin.repositoryVisibility || item.archived) throw new IngestionError("ACCESS_REVOKED");
      await this.archive.download({ owner: item.owner.login, name: item.name, commitSha: pin.commitSha }, credential,
        destination, pin.policy.limits.compressedBytes, signal, checkpoint);
    }).catch(error => { throw sourceError(error); });
  }
}

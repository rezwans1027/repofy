import type { GitHubDiscoveryIssue } from "@repofy/contracts";

export type GitHubErrorCode = GitHubDiscoveryIssue | "invalid_request" | "invalid_state" | "not_found" | "database_failure";
const messages: Record<GitHubErrorCode, string> = {
  invalid_request: "Invalid GitHub connection request.",
  invalid_state: "This connection attempt expired or belongs to a different session. Start again from Repofy.",
  not_found: "GitHub connection not found.",
  database_failure: "GitHub connection could not be saved. Try again later.",
  reconnect_required: "Reconnect your GitHub identity. For organization access, sign in to your organization's SSO first.",
  identity_conflict: "This GitHub identity cannot be linked to this account.",
  installation_missing: "Install or reconnect the GitHub App for this account.",
  installation_suspended: "The GitHub App installation is suspended. Ask the installation owner to restore access.",
  pending_approval: "An organization owner must approve the GitHub App installation.",
  insufficient_permissions: "Grant the GitHub App read access to repository contents.",
  access_changed: "Repository access or ownership changed. Refresh your repository list.",
  rate_limited: "GitHub's request limit was reached. Try again after the indicated delay.",
  provider_unavailable: "GitHub is temporarily unavailable. Try again later.",
  pagination_limit: "The discovery limit was reached. Narrow the installation's selected repositories.",
};
export class GitHubAppError extends Error {
  constructor(readonly code: GitHubErrorCode, readonly retryAfterSeconds?: number) {
    super(messages[code]); this.name = "GitHubAppError";
  }
}
export function safeGitHubError(error: unknown): GitHubAppError {
  return error instanceof GitHubAppError ? error : new GitHubAppError("provider_unavailable");
}

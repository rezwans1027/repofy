import { z } from "zod";
import { GitHubAccountIdSchema, InstallationIdSchema, RepositoryIdSchema, TimestampSchema } from "./primitives";

export const GitHubReturnPathSchema = z.enum(["/readiness", "/readiness/new"]);
export const GitHubConnectionStartSchema = z.strictObject({
  intent: z.enum(["install", "link"]).default("install"),
  returnTo: GitHubReturnPathSchema.default("/readiness/new"),
  accountId: GitHubAccountIdSchema.optional(),
});
export const GitHubConnectionStartResponseSchema = z.strictObject({
  authorizeUrl: z.url().refine(value => new URL(value).origin === "https://github.com"),
  expiresAt: TimestampSchema,
});
export const GitHubPermissionSchema = z.enum(["none", "read", "write"]);
export const GitHubPermissionStatusSchema = z.strictObject({
  contents: GitHubPermissionSchema, pullRequests: GitHubPermissionSchema,
  checks: GitHubPermissionSchema, actions: GitHubPermissionSchema, commitStatuses: GitHubPermissionSchema,
});
export const GitHubDiscoveryIssueSchema = z.enum([
  "reconnect_required", "identity_conflict", "installation_missing", "installation_suspended",
  "pending_approval", "insufficient_permissions", "access_changed", "rate_limited", "provider_unavailable",
  "pagination_limit",
]);
export type GitHubDiscoveryIssue = z.infer<typeof GitHubDiscoveryIssueSchema>;
export const GitHubAccountSummarySchema = z.strictObject({
  accountId: GitHubAccountIdSchema, login: z.string().min(1).max(100),
  status: z.enum(["connected", "reconnect_required", "unlinked"]),
  verifiedAt: TimestampSchema,
});
export const GitHubAccountsResponseSchema = z.strictObject({
  accounts: z.array(GitHubAccountSummarySchema).max(20),
  connectPath: z.literal("/api/v1/github/installations/start"),
});
export const GitHubInstallationSummarySchema = z.strictObject({
  installationId: InstallationIdSchema, accountId: GitHubAccountIdSchema,
  ownerLogin: z.string().min(1).max(100), ownerType: z.enum(["User", "Organization"]),
  status: z.enum(["active", "suspended"]), selection: z.enum(["all", "selected"]),
  permissions: GitHubPermissionStatusSchema,
});
export const GitHubRepositorySummarySchema = z.strictObject({
  repositoryId: RepositoryIdSchema, installationId: InstallationIdSchema, accountId: GitHubAccountIdSchema,
  fullName: z.string().min(3).max(250), visibility: z.enum(["public", "private"]),
  defaultBranch: z.string().min(1).max(255).nullable(), archived: z.boolean(),
});
const page = {
  status: z.enum(["complete", "partial", "unavailable"]),
  nextCursor: z.string().min(16).max(2000).nullable(),
  issues: z.array(GitHubDiscoveryIssueSchema).max(12),
  retryAfterSeconds: z.number().int().min(1).max(86400).optional(),
  connectPath: z.literal("/api/v1/github/installations/start"),
};
export const GitHubInstallationsResponseSchema = z.strictObject({ ...page, installations: z.array(GitHubInstallationSummarySchema).max(100) });
export const GitHubRepositoriesResponseSchema = z.strictObject({ ...page, repositories: z.array(GitHubRepositorySummarySchema).max(100) });
export const GitHubPageQuerySchema = z.strictObject({
  accountId: GitHubAccountIdSchema, cursor: z.string().min(16).max(2000).optional(),
  perPage: z.string().regex(/^[1-9]\d{0,2}$/).transform(Number).pipe(z.number().int().max(100)).optional(),
});
export const GitHubRepositoryQuerySchema = GitHubPageQuerySchema.extend({ installationId: InstallationIdSchema });
export type GitHubPermissionStatus = z.infer<typeof GitHubPermissionStatusSchema>;

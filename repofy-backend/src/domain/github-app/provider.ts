import { z } from "zod";
import { GitHubCommitShaSchema, GitHubProviderIdSchema } from "@repofy/contracts";

// Reject unsafe JSON numbers instead of silently rounding provider identities.
export const ProviderId = z.union([GitHubProviderIdSchema, z.number().int().positive().max(Number.MAX_SAFE_INTEGER).transform(String)]);
export const Login = z.string().min(1).max(100).regex(/^[A-Za-z0-9][A-Za-z0-9-]*$/);
export const RepoName = z.string().min(1).max(100).regex(/^[A-Za-z0-9_.-]+$/).refine(v => v !== "." && v !== "..");
export const ProviderUserSchema = z.object({ id: ProviderId, login: Login });
export const ProviderInstallationSchema = z.object({
  id: ProviderId, app_id: ProviderId, account: z.object({ id: ProviderId, login: Login, type: z.enum(["User", "Organization"]) }),
  repository_selection: z.enum(["all", "selected"]), suspended_at: z.string().datetime({ offset: true }).nullable(),
  permissions: z.record(z.string().max(100), z.enum(["read", "write"])),
});
export const ProviderRepositorySchema = z.object({
  id: ProviderId, name: RepoName, owner: z.object({ id: ProviderId, login: Login }),
  private: z.boolean(), default_branch: z.string().min(1).max(255).nullable(), archived: z.boolean(),
  permissions: z.object({ pull: z.boolean() }),
  fork: z.boolean().optional(),
  template_repository: z.object({ id: ProviderId }).nullable().optional(),
});
export const BranchSchema = z.string().min(1).max(255).refine(value =>
  !/[\x00-\x20\x7f~^:?*\[\\]/.test(value) && !value.includes("..") && !value.includes("@{")
  && !value.includes("//") && value !== "@" && !value.startsWith("/") && !value.endsWith("/")
  && value.split("/").every(part => !part.startsWith(".") && !part.endsWith(".") && !part.endsWith(".lock")), "Invalid branch");
export const CommitSchema = z.object({ ref: z.string(), object: z.object({ type: z.literal("commit"), sha: GitHubCommitShaSchema }) });
export type ProviderUser = z.infer<typeof ProviderUserSchema>;
export type ProviderInstallation = z.infer<typeof ProviderInstallationSchema>;
export type ProviderRepository = z.infer<typeof ProviderRepositorySchema>;
export interface ProviderPage<T> { items: T[]; hasNext: boolean }
export interface UserCredential { token: string; expiresAt: string }
export type ReadPermission = "contents" | "pull_requests" | "checks" | "actions" | "statuses";
export interface InstallationCredential { token: string; expiresAt: string; assertValid(): void }

export interface GitHubAppProvider {
  exchangeCode(code: string, verifier: string, redirectUri: string): Promise<UserCredential>;
  getUser(token: string): Promise<ProviderUser>;
  listInstallations(token: string, page: number, perPage: number): Promise<ProviderPage<ProviderInstallation>>;
  getInstallation(id: string): Promise<ProviderInstallation>;
  listRepositories(token: string, installation: string, page: number, perPage: number): Promise<ProviderPage<ProviderRepository>>;
  getRepository(token: string, owner: string, name: string): Promise<ProviderRepository>;
  getRepositoryInstallation(owner: string, name: string): Promise<ProviderInstallation>;
  withInstallationToken<T>(installation: string, repositoryIds: string[], permissions: ReadPermission[], use: (credential: InstallationCredential) => Promise<T>): Promise<T>;
  resolveCommit(token: string, owner: string, name: string, branch: string): Promise<string>;
}

import { z } from "zod";
import {
  AccessGrantIdSchema, AttestationIdSchema, ContractVersionSchema, GitHubAccountIdSchema,
  GitHubCommitShaSchema, GitHubProviderIdSchema, InstallationIdSchema, RepositoryIdSchema,
  RepositoryVisibilitySchema, ShortTextSchema, SnapshotIdSchema, TimestampSchema, UserIdSchema,
  VersionSchema, Sha256Schema, uniqueArray,
} from "./primitives";

export const VerifiedIdentityReferenceSchema = z.strictObject({
  githubAccountId: GitHubAccountIdSchema,
  userId: UserIdSchema,
  provider: z.literal("github"),
  providerUserId: GitHubProviderIdSchema,
  verifiedAt: TimestampSchema,
});
export const RepositorySelectionSchema = z.strictObject({
  repositoryId: RepositoryIdSchema,
  selected: z.boolean(),
});
// Server-issued record; a browser cannot self-assert an identity, grant, or timestamp.
export const AccessAttestationSchema = z.strictObject({
  contractVersion: ContractVersionSchema,
  attestationId: AttestationIdSchema,
  userId: UserIdSchema,
  githubAccountId: GitHubAccountIdSchema,
  installationId: InstallationIdSchema,
  repositoryIds: uniqueArray(RepositoryIdSchema, 10, 1),
  accessGrantIds: uniqueArray(AccessGrantIdSchema, 10, 1),
  statementVersion: VersionSchema,
  authorized: z.literal(true),
  attestedAt: TimestampSchema,
}).refine((value) => value.repositoryIds.length === value.accessGrantIds.length, "Each repository needs a grant");

export const RepositorySnapshotSchema = z.strictObject({
  contractVersion: ContractVersionSchema,
  snapshotId: SnapshotIdSchema,
  repositoryId: RepositoryIdSchema,
  provider: z.literal("github"),
  providerRepositoryId: GitHubProviderIdSchema,
  commitSha: GitHubCommitShaSchema,
  // The resolved branch is provenance; subsequent retrieval always uses commitSha.
  branch: z.string().min(1).max(255).refine((value) => !/[\s\x00-\x1f\x7f~^:?*\[\\]/.test(value) &&
    !value.includes("..") && !value.includes("@{") && !value.includes("//") &&
    !value.startsWith("/") && !value.endsWith("/") && !value.endsWith(".") &&
    value !== "@" && value.split("/").every((part) => !part.startsWith(".") && !part.endsWith(".lock")), "Invalid branch reference"),
  repositoryVisibility: RepositoryVisibilitySchema,
  snapshotIdentityVersion: VersionSchema,
  extractionPolicyVersion: VersionSchema,
  securityPolicyHash: Sha256Schema.optional(),
  createdAt: TimestampSchema,
});

// Only construct after owner authorization and label redaction. Provider IDs/branch names stay internal.
export const OwnerSnapshotSchema = RepositorySnapshotSchema.omit({ providerRepositoryId: true, branch: true }).extend({
  repositoryLabel: ShortTextSchema,
});
export type VerifiedIdentityReference = z.infer<typeof VerifiedIdentityReferenceSchema>;
export type RepositorySelection = z.infer<typeof RepositorySelectionSchema>;
export type AccessAttestation = z.infer<typeof AccessAttestationSchema>;
export type RepositorySnapshot = z.infer<typeof RepositorySnapshotSchema>;
export type OwnerSnapshot = z.infer<typeof OwnerSnapshotSchema>;

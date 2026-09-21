import { z } from "zod";
import { GitHubRepositorySummarySchema } from "./github-app";
import { CoverageDeclarationSchema } from "./assessability";

export const REPOSITORY_ATTESTATION_VERSION = "1.0.0" as const;
export const REPOSITORY_ATTESTATION_TEXT = "I own or am authorized to submit the selected private and organization repositories to Repofy for analysis. Organization installation approval does not replace my authorization.";
export const RepositoryChoiceSchema = z.strictObject({ repositoryId: z.uuid(), accountId: z.uuid(), installationId: z.uuid() });
export const SaveRepositorySelectionSchema = z.strictObject({
  repositories: z.array(RepositoryChoiceSchema).max(10).refine(items => new Set(items.map(item => item.repositoryId)).size === items.length, "Duplicate repository"),
  expectedRevision: z.uuid(), idempotencyKey: z.uuid(),
  attestation: z.strictObject({ version: z.literal(REPOSITORY_ATTESTATION_VERSION), accepted: z.literal(true) }).optional(),
});
export const SelectedRepositorySchema = GitHubRepositorySummarySchema.extend({
  ownerType: z.enum(["User", "Organization"]), grantId: z.uuid(), accessRevision: z.uuid(),
  status: z.enum(["active", "revoked"]), attestedAt: z.iso.datetime(),
});
export const SavedRepositorySelectionSchema = z.strictObject({
  revision: z.uuid(), repositories: z.array(SelectedRepositorySchema).max(10),
  policy: z.strictObject({ maxRepositories: z.number().int().min(1).max(10),
    attestationVersion: z.literal(REPOSITORY_ATTESTATION_VERSION), attestationText: z.literal(REPOSITORY_ATTESTATION_TEXT),
    allowArchived: z.literal(false), requireDefaultBranch: z.literal(true), analysisAvailable: z.boolean(), coverage: CoverageDeclarationSchema.optional() }),
});
export type RepositoryChoice = z.infer<typeof RepositoryChoiceSchema>;
export type SavedRepositorySelection = z.infer<typeof SavedRepositorySelectionSchema>;
export type SelectedRepository = z.infer<typeof SelectedRepositorySchema>;

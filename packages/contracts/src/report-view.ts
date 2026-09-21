import { z } from "zod";
import { AggregationResultSchema, AggregationEvidenceQuerySchema, AggregationSupportSchema } from "./aggregation";
import { ReadinessReportResponseSchema, CapabilityDefinitionSchema } from "./readiness";
import { OwnerEvidenceSchema } from "./evidence";
import { KeySchema, RoleIdSchema, ShortTextSchema, TimestampSchema, GitHubCommitShaSchema } from "./primitives";

export const ReportHistoryQuerySchema = z.strictObject({ afterReportId: z.uuid().optional(), limit: z.number().int().min(1).max(50).default(20) });
export const ReportHistorySchema = z.strictObject({ items: z.array(z.strictObject({
  reportId: z.uuid(), jobId: z.uuid(), runId: z.uuid(), createdAt: TimestampSchema,
  repositoryCount: z.number().int().min(1).max(10),
})).max(50), nextReportId: z.uuid().nullable() });
export const ReportRepositoryAccessSchema = z.strictObject({
  repositoryId: z.uuid(), snapshotId: z.uuid(), visibility: z.enum(["public", "private"]),
  access: z.enum(["active", "revoked"]),
});
export const ReportViewSchema = z.strictObject({
  report: ReadinessReportResponseSchema, aggregation: AggregationResultSchema.nullable(),
  repositories: z.array(ReportRepositoryAccessSchema).min(1).max(10),
  categories: z.array(z.strictObject({ categoryId: KeySchema, label: ShortTextSchema })).max(30),
  capabilities: z.array(CapabilityDefinitionSchema).max(100),
  roleDefinitions: z.array(z.strictObject({ roleId: RoleIdSchema, name: ShortTextSchema,
    requirements: z.array(z.strictObject({ requirementId: KeySchema, label: ShortTextSchema })).max(100),
  })).max(5),
}).superRefine((view, ctx) => {
  const { report: r, aggregation: a } = view;
  if (view.repositories.length !== r.snapshots.length || new Set(view.repositories.map(s => s.snapshotId)).size !== r.snapshots.length ||
    view.repositories.some(s => !r.snapshots.some(t => t.snapshotId === s.snapshotId && t.repositoryId === s.repositoryId && t.repositoryVisibility === s.visibility)) ||
    a && (a.runId !== r.analysisRunId || a.jobId !== r.jobId || a.ownerUserId !== r.ownerUserId ||
      a.snapshotIds.length !== r.snapshots.length || a.snapshotIds.some(id => !r.snapshots.some(s => s.snapshotId === id)))) {
    ctx.addIssue({ code: "custom", message: "Report view membership mismatch" });
  }
  if (a) {
    const capabilities = r.capabilityGroups.flatMap(g => g.capabilities);
    if (JSON.stringify(a.versions) !== JSON.stringify(r.versions) || capabilities.length !== a.capabilities.length || capabilities.some(c => {
      const computed = a.capabilities.find(v => v.capabilityId === c.capabilityId);
      return !computed || computed.state !== c.state || c.state !== "unknown" && computed.confidence !== c.confidence || c.state === "assessed" && computed.strength !== c.strength;
    }) || r.roles.some(role => {
      const computed = a.roles.find(v => v.template.roleId === role.template.roleId);
      return !computed || computed.state !== role.state || role.state === "assessed" && (computed.coverage !== role.coverage || computed.confidence !== role.confidence);
    })) ctx.addIssue({ code: "custom", message: "Calculation trace differs from saved report" });
  }
});
export const ReportEvidenceQuerySchema = AggregationEvidenceQuerySchema.safeExtend({ capabilityId: KeySchema.optional(), evidenceId: z.uuid().optional() });
export const ReportEvidenceItemSchema = z.strictObject({ evidence: OwnerEvidenceSchema,
  support: z.array(AggregationSupportSchema).max(100), access: z.enum(["active", "revoked"]),
});
export const ReportEvidencePageSchema = z.strictObject({ items: z.array(ReportEvidenceItemSchema).max(100), nextEvidenceId: z.uuid().nullable() });

// Only exact-commit file links. No branch heads, redirects, query strings or arbitrary hosts.
export function isPinnedGitHubUrl(value: string): boolean {
  const match = /^https:\/\/github\.com\/([A-Za-z0-9-]+)\/([A-Za-z0-9_.-]+)\/blob\/([a-f0-9]{40})\/([^?#]+)(?:#L[1-9]\d*(?:-L[1-9]\d*)?)?$/.exec(value);
  if (!match || [".", ".."].includes(match[2])) return false;
  try { return match[4].split("/").every(part => { const decoded = decodeURIComponent(part); return !!decoded && ![".", ".."].includes(decoded) && !/[\\/\x00-\x1f\x7f]/.test(decoded); }); }
  catch { return false; }
}
export const EvidenceLocationResponseSchema = z.discriminatedUnion("state", [
  z.strictObject({ state: z.literal("available"), evidenceId: z.uuid(), commitSha: GitHubCommitShaSchema,
    label: z.string().min(1).max(1024), repositoryLabel: ShortTextSchema, visibility: z.enum(["public", "private"]),
    lines: z.strictObject({ start: z.number().int().positive(), end: z.number().int().positive() }).optional(),
    url: z.string().max(6000).refine(isPinnedGitHubUrl).optional(),
  }).refine(v => (!v.url || v.visibility === "public" && v.url.includes(`/blob/${v.commitSha}/`)) && (!v.lines || v.lines.end >= v.lines.start)),
  z.strictObject({ state: z.enum(["access_revoked", "unavailable", "not_retained"]), evidenceId: z.uuid() }),
]);
export const ReportEventSchema = z.discriminatedUnion("event", [
  z.strictObject({ event: z.literal("report_viewed") }),
  z.strictObject({ event: z.literal("evidence_opened"), objectId: z.uuid() }),
  z.strictObject({ event: z.literal("improvement_opened"), objectId: z.uuid() }),
]);
export type ReportView = z.infer<typeof ReportViewSchema>;
export type ReportHistory = z.infer<typeof ReportHistorySchema>;
export type ReportEvidenceQuery = z.input<typeof ReportEvidenceQuerySchema>;
export type ReportEvidenceItem = z.infer<typeof ReportEvidenceItemSchema>;
export type ReportEvidencePage = z.infer<typeof ReportEvidencePageSchema>;
export type EvidenceLocationResponse = z.infer<typeof EvidenceLocationResponseSchema>;
export type ReportEvent = z.infer<typeof ReportEventSchema>;

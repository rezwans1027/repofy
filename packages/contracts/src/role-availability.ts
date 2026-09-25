import { z } from "zod";
import { RoleTemplateReferenceSchema } from "./primitives";
import type { ReadinessReportResponse } from "./readiness";

/** Read-time interpretation, separate from immutable rubric calculations. */
export const RoleAvailabilitySchema = z.discriminatedUnion("state", [
  // Reserved for a policy explicitly qualified in roleAvailability below.
  z.strictObject({ template: RoleTemplateReferenceSchema, state: z.literal("available") }),
  z.strictObject({ template: RoleTemplateReferenceSchema, state: z.literal("unavailable"),
    reason: z.enum(["required_confidence_unattainable", "policy_not_qualified"]) }),
  z.strictObject({ template: RoleTemplateReferenceSchema, state: z.literal("unknown"), reason: z.literal("insufficient_coverage") }),
]);
export type RoleAvailability = z.infer<typeof RoleAvailabilitySchema>;

export function roleAvailability(report: Pick<ReadinessReportResponse, "versions" | "roles">): RoleAvailability[] {
  const policy = report.versions.aggregationPolicy;
  // ADR 0011's behavioral scopes are partial: both registered policies cap the
  // label at Low while the initial rubrics require Moderate. A numerical result
  // is still a reproducible calculation, but cannot be a role readiness score.
  // A future policy must explicitly qualify this projection; an unknown version
  // must never silently enable scores. No frozen math or confidence is rewritten.
  const limited = policy.id === "evidence_aggregation" && ["1.0.0", "1.1.0"].includes(policy.version)
    && report.versions.taxonomy.id === "engineering_capabilities" && report.versions.taxonomy.version === "1.0.0";
  return report.roles.map(role => role.state === "unknown"
    ? { template: role.template, state: "unknown", reason: "insufficient_coverage" }
    : { template: role.template, state: "unavailable", reason: limited && role.template.version === "1.0.0"
      ? "required_confidence_unattainable" : "policy_not_qualified" });
}

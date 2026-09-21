import { ReadinessReportResponseSchema } from "@repofy/contracts";

export function parseReadinessReport(input: unknown) {
  return ReadinessReportResponseSchema.parse(input);
}

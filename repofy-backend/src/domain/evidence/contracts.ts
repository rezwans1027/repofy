import { ReadinessReportResponseSchema } from "@repofy/contracts";
import { InternalEvidenceObservationSchema } from "@repofy/contracts/internal";

// Structural boundaries only. Persistence must also run ReadinessDomainValidator.
export function parseEvidenceObservation(input: unknown) {
  return InternalEvidenceObservationSchema.parse(input);
}

export function parseReadinessReport(input: unknown) {
  return ReadinessReportResponseSchema.parse(input);
}

import { createHash } from "node:crypto";
import { StartAnalysisRequestSchema } from "@repofy/contracts";

export function canonicalAnalysisRequest(input: unknown) {
  const request = StartAnalysisRequestSchema.parse(input);
  // Fixed key order, sorted set membership, and explicit metadata defaults. Identity, price,
  // versions resolved by the server, and the key itself are never browser-controlled hash fields.
  const canonical = JSON.stringify({
    contractVersion: request.contractVersion,
    repositoryIds: [...request.repositoryIds].sort(),
    targetRoleTemplate: request.targetRoleTemplate ?? null,
    includeMetadata: request.includeMetadata,
    failurePolicy: request.failurePolicy,
  });
  return { request, requestHash: `sha256:${createHash("sha256").update(canonical).digest("hex")}` };
}

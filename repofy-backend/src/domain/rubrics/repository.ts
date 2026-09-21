import { KeySchema, RubricDiscoveryResponseSchema, UserIdSchema } from "@repofy/contracts";
import type { FeatureOneRpcClient } from "../analysis/persistence";

export class RubricRepository {
  constructor(private readonly client: FeatureOneRpcClient) {}

  async read(actor: string, releaseId?: string) {
    UserIdSchema.parse(actor);
    if (releaseId !== undefined) KeySchema.parse(releaseId);
    try {
      const { data, error } = await this.client.rpc("feature_one_read_rubric_catalog", {
        p_actor: actor, p_release_id: releaseId ?? null,
      });
      if (error) throw new Error("Database failure");
      return data === null ? null : RubricDiscoveryResponseSchema.parse(data);
    } catch {
      // Provider errors and invalid stored JSON are never returned or logged verbatim.
      throw new Error("Rubric discovery unavailable");
    }
  }
}

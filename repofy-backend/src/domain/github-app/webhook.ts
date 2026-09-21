import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { FeatureOneRpcClient } from "../analysis/persistence";
import { ProviderId } from "./provider";
import { SelectionError } from "./selection";

const envelope = z.object({ action: z.string().max(80).optional(), installation: z.object({ id: ProviderId }).optional(),
  repositories_removed: z.array(z.object({ id: ProviderId })).max(10000).optional(), sender: z.object({ id: ProviderId }).optional(),
  repository: z.object({ id: ProviderId }).optional() });
const actions: Record<string, string[]> = {
  installation: ["created", "deleted", "suspend", "unsuspend", "new_permissions_accepted"],
  installation_repositories: ["added", "removed"], github_app_authorization: ["revoked"],
  repository: ["deleted", "privatized", "publicized", "transferred", "archived", "unarchived", "renamed", "edited"],
  member: ["added", "removed", "edited"], membership: ["added", "removed"], organization: ["member_removed"],
};
export class GitHubWebhookService {
  constructor(private readonly db: FeatureOneRpcClient, private readonly secret: string) {}
  async receive(raw: unknown, signature: unknown, delivery: unknown, event: unknown) {
    if (!this.secret) throw new SelectionError("INTERNAL_ERROR", "GitHub webhook verification is not configured.", 503);
    if (!Buffer.isBuffer(raw) || typeof signature !== "string" || !/^sha256=[a-f0-9]{64}$/.test(signature)
      || !timingSafeEqual(createHmac("sha256", this.secret).update(raw).digest(), Buffer.from(signature.slice(7), "hex"))) {
      throw new SelectionError("FORBIDDEN", "Invalid webhook signature.", 401);
    }
    if (!z.uuid().safeParse(delivery).success || typeof event !== "string" || !/^[a-z_]{1,80}$/.test(event)) throw new SelectionError("INVALID_REQUEST", "Invalid webhook metadata.", 400);
    let body;
    try { body = envelope.parse(JSON.parse(raw.toString("utf8"))); } catch { throw new SelectionError("INVALID_REQUEST", "Invalid webhook payload.", 400); }
    const action = body.action ?? "";
    const handled = actions[event]?.includes(action) ?? false;
    if (handled && ((event === "github_app_authorization" && !body.sender) || (event !== "github_app_authorization" && !body.installation)
      || (event === "installation_repositories" && !body.repositories_removed)
      || (["repository", "member"].includes(event) && !body.repository))) throw new SelectionError("INVALID_REQUEST", "Incomplete webhook payload.", 400);
    // Store only safe receipt metadata and effects. Raw bodies, signatures and names are discarded.
    const { data, error } = await this.db.rpc("feature_one_github_webhook", { p_delivery: delivery,
      p_hash: createHash("sha256").update(raw).digest("hex"), p_event: handled ? event : "ignored", p_action: action,
      p_installation: handled ? body.installation?.id ?? null : null,
      p_repositories: !handled ? [] : event === "installation_repositories" ? body.repositories_removed!.map(repo => repo.id)
        : body.repository ? [body.repository.id] : [],
      p_provider_user: handled && event === "github_app_authorization" ? body.sender!.id : null });
    if (error) throw new SelectionError(error.message === "INVALID_REQUEST" ? "INVALID_REQUEST" : "INTERNAL_ERROR",
      "GitHub delivery could not be processed.", error.message === "INVALID_REQUEST" ? 400 : 503);
    return { received: true, duplicate: data === true };
  }
}

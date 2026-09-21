import { ClientCapabilitiesSchema, DISABLED_CLIENT_CAPABILITIES, type ClientCapabilities } from "@repofy/contracts";
import { serverFetch } from "./server-api";

// No NEXT_PUBLIC feature switches: the API is the authority, and failures hide the feature.
export async function loadFeatureCapabilities(): Promise<ClientCapabilities> {
  try {
    const result = await serverFetch("/v1/capabilities", { schema: ClientCapabilitiesSchema });
    return result.data ?? DISABLED_CLIENT_CAPABILITIES;
  } catch {
    return DISABLED_CLIENT_CAPABILITIES;
  }
}

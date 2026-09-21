import { describe, expect, it, vi } from "vitest";
import { DISABLED_CLIENT_CAPABILITIES } from "@repofy/contracts";
import { serverFetch } from "./server-api";
import { loadFeatureCapabilities } from "./feature-capabilities";

vi.mock("./server-api", () => ({ serverFetch: vi.fn() }));

describe("server-authoritative client capabilities", () => {
  it("requests the additive path with runtime validation and no cache opt-in", async () => {
    vi.mocked(serverFetch).mockResolvedValue({ data: DISABLED_CLIENT_CAPABILITIES, error: null });
    expect(await loadFeatureCapabilities()).toEqual(DISABLED_CLIENT_CAPABILITIES);
    expect(serverFetch).toHaveBeenCalledWith("/v1/capabilities", { schema: expect.anything() });
  });

  it("hides the feature on backend failure or missing auth", async () => {
    vi.mocked(serverFetch).mockResolvedValue({ data: null, error: "unauthenticated" });
    expect(await loadFeatureCapabilities()).toEqual(DISABLED_CLIENT_CAPABILITIES);
    vi.mocked(serverFetch).mockRejectedValue(new Error("Synthetic offline state"));
    expect(await loadFeatureCapabilities()).toEqual(DISABLED_CLIENT_CAPABILITIES);
  });
});

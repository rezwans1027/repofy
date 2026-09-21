import { describe, expect, it } from "vitest";
import { ClientCapabilitiesSchema, DISABLED_FEATURE_FLAGS } from "@repofy/contracts";
import { clientCapabilities, readFeatureOneConfig } from "../../../src/config/feature-one";

describe("Feature 1 configuration", () => {
  it("defaults off and requires no installation credentials", () => {
    expect(readFeatureOneConfig({})).toEqual({ flags: DISABLED_FEATURE_FLAGS, githubApp: undefined, githubWebhookSecret: undefined, maxRepositories: 5, provenanceEnabled: false });
  });

  it("the master switch suppresses child flags without loading credentials", () => {
    expect(readFeatureOneConfig({ FEATURE_ONE_PROVENANCE_ENABLED: "true" }).provenanceEnabled).toBe(false);
    expect(readFeatureOneConfig({ FEATURE_ONE_ENABLED: "true", FEATURE_ONE_PROVENANCE_ENABLED: "true" }).provenanceEnabled).toBe(true);
    expect(() => readFeatureOneConfig({ FEATURE_ONE_PROVENANCE_ENABLED: "private-sentinel" })).toThrow("FEATURE_ONE_PROVENANCE_ENABLED must be true or false");
    expect(readFeatureOneConfig({ GITHUB_APP_REPOSITORIES_ENABLED: "true", RESCANS_ENABLED: "true", FINDING_FEEDBACK_ENABLED: "true" }).flags)
      .toEqual(DISABLED_FEATURE_FLAGS);
    expect(readFeatureOneConfig({ FEATURE_ONE_ENABLED: "true" }).githubApp).toBeUndefined();
  });

  it.each(["GITHUB_APP_ID", "GITHUB_APP_PRIVATE_KEY", "GITHUB_APP_WEBHOOK_SECRET", "GITHUB_APP_SLUG"])("requires %s only for the enabled integration", (name) => {
    const source: Record<string, string> = { FEATURE_ONE_ENABLED: "true", GITHUB_APP_REPOSITORIES_ENABLED: "true",
      GITHUB_APP_ID: "123", GITHUB_APP_SLUG: "fixture-app", GITHUB_APP_PRIVATE_KEY: "synthetic-key-sentinel", GITHUB_APP_WEBHOOK_SECRET: "synthetic-webhook-sentinel" };
    delete source[name];
    expect(() => readFeatureOneConfig(source)).toThrow(name);
    source[name] = "<placeholder>";
    expect(() => readFeatureOneConfig(source)).toThrow(name);
  });

  it("never includes configuration values in validation failures", () => {
    expect(() => readFeatureOneConfig({ FEATURE_ONE_ENABLED: "private-sentinel" })).toThrow("Environment variable FEATURE_ONE_ENABLED must be true or false");
    expect(() => readFeatureOneConfig({ FEATURE_ONE_ENABLED: "true", GITHUB_APP_REPOSITORIES_ENABLED: "true",
      GITHUB_APP_ID: "private-sentinel", GITHUB_APP_PRIVATE_KEY: "synthetic", GITHUB_APP_WEBHOOK_SECRET: "synthetic" }))
      .toThrow("Environment variable GITHUB_APP_ID must be a positive provider ID");
  });

  it("mirrors flags but cannot advertise unfinished functionality or secrets", () => {
    const config = readFeatureOneConfig({ FEATURE_ONE_ENABLED: "true", GITHUB_APP_REPOSITORIES_ENABLED: "true",
      RESCANS_ENABLED: "true", FINDING_FEEDBACK_ENABLED: "true", GITHUB_APP_ID: "123", GITHUB_APP_SLUG: "fixture-app",
      GITHUB_APP_PRIVATE_KEY: "synthetic-key-sentinel", GITHUB_APP_WEBHOOK_SECRET: "synthetic-webhook-sentinel" });
    const client = ClientCapabilitiesSchema.parse(clientCapabilities(config.flags));
    expect(client.features).toEqual({ featureOneEnabled: true, githubAppRepositoriesEnabled: true, rescansEnabled: true, findingFeedbackEnabled: true });
    expect(client.readinessAvailability).toBe("available");
    expect(JSON.stringify(client)).not.toContain("sentinel");
    expect(Object.keys(client)).toEqual(["contractVersion", "features", "readinessAvailability"]);
  });
});

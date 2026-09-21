import { CONTRACT_VERSION, type ClientCapabilities, type FeatureFlags } from "@repofy/contracts";

type Environment = Readonly<Record<string, string | undefined>>;

function flag(source: Environment, name: string): boolean {
  const value = source[name];
  if (value === undefined || value === "false") return false;
  if (value === "true") return true;
  throw new Error(`Environment variable ${name} must be true or false`);
}

function credential(source: Environment, name: string): string {
  const value = source[name]?.trim();
  if (!value || /^<.*>$/.test(value)) throw new Error(`Missing or placeholder environment variable: ${name}`);
  return value;
}

export function readFeatureOneConfig(source: Environment) {
  const enabled = flag(source, "FEATURE_ONE_ENABLED");
  const repositories = flag(source, "GITHUB_APP_REPOSITORIES_ENABLED");
  const rescans = flag(source, "RESCANS_ENABLED");
  const feedback = flag(source, "FINDING_FEEDBACK_ENABLED");
  const provenance = flag(source, "FEATURE_ONE_PROVENANCE_ENABLED");
  const flags: FeatureFlags = {
    featureOneEnabled: enabled,
    githubAppRepositoriesEnabled: enabled && repositories,
    rescansEnabled: enabled && rescans,
    findingFeedbackEnabled: enabled && feedback,
  };
  // OAuth login credentials remain separate and retain their existing requirements.
  const githubApp = flags.githubAppRepositoriesEnabled ? {
    appId: credential(source, "GITHUB_APP_ID"),
    privateKey: credential(source, "GITHUB_APP_PRIVATE_KEY"),
    webhookSecret: credential(source, "GITHUB_APP_WEBHOOK_SECRET"),
    slug: source.GITHUB_APP_SLUG?.trim() ?? "",
  } : undefined;
  if (githubApp && !/^[1-9]\d{0,19}$/.test(githubApp.appId)) {
    throw new Error("Environment variable GITHUB_APP_ID must be a positive provider ID");
  }
  if (githubApp && !/^[a-z0-9][a-z0-9-]{0,99}$/.test(githubApp.slug)) {
    throw new Error("Environment variable GITHUB_APP_SLUG must be the registered app slug");
  }
  const maxRepositories = Number(source.FEATURE_ONE_MAX_REPOSITORIES ?? "5");
  if (!Number.isInteger(maxRepositories) || maxRepositories < 1 || maxRepositories > 10) {
    throw new Error("FEATURE_ONE_MAX_REPOSITORIES must be an integer between 1 and 10");
  }
  // Security deliveries remain enabled independently of UI/intake flags.
  const webhookSecret = source.GITHUB_APP_WEBHOOK_SECRET?.trim();
  const githubWebhookSecret = webhookSecret && !/^<.*>$/.test(webhookSecret) ? webhookSecret : undefined;
  return { flags, githubApp, githubWebhookSecret, maxRepositories, provenanceEnabled: enabled && provenance };
}

export function clientCapabilities(flags: FeatureFlags): ClientCapabilities {
  return {
    contractVersion: CONTRACT_VERSION,
    features: { ...flags },
    // Saved-report UI is implemented. Intake remains separately owner-allowlisted
    // and requires the full worker composition; this flag does not promise model access.
    readinessAvailability: flags.featureOneEnabled ? "available" : "disabled",
  };
}

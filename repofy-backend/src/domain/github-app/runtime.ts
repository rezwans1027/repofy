import { env } from "../../config/env";
import { getSupabaseAdmin } from "../../config/supabase";
import { GitHubHttpClient } from "./client";
import { GitHubVault } from "./crypto";
import { GitHubAppError } from "./errors";
import { GitHubConnectionRepository } from "./repository";
import { GitHubConnectionService } from "./service";
import { RepositorySelectionService } from "./selection";

export function repositorySelectionService(): RepositorySelectionService {
  // Reads/removal do not need provider credentials; provider construction is lazy.
  const github = { verifyRepository: (...args: Parameters<GitHubConnectionService["verifyRepository"]>) => githubConnectionService().verifyRepository(...args) };
  return new RepositorySelectionService(getSupabaseAdmin(), github,
    new GitHubVault(env.tokenEncryptionKey), env.featureOne.maxRepositories);
}

export function githubConnectionService(): GitHubConnectionService {
  const config = env.featureOne.githubApp;
  if (!config) throw new GitHubAppError("provider_unavailable");
  let origin: URL;
  try { origin = new URL(env.frontendUrl); } catch { throw new GitHubAppError("provider_unavailable"); }
  if (origin.username || origin.password || origin.search || origin.hash || origin.pathname !== "/"
    || (origin.protocol !== "https:" && !(origin.protocol === "http:" && !env.isProduction && ["localhost", "127.0.0.1"].includes(origin.hostname)))) throw new GitHubAppError("provider_unavailable");
  return new GitHubConnectionService(new GitHubConnectionRepository(getSupabaseAdmin()),
    new GitHubHttpClient({ appId: config.appId, clientId: env.githubAppClientId, clientSecret: env.githubAppClientSecret,
      privateKey: () => config.privateKey }), new GitHubVault(env.tokenEncryptionKey),
    { appId: config.appId, clientId: env.githubAppClientId, slug: config.slug, frontendOrigin: origin.origin });
}

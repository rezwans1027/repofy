import type { GitHubUserData, AdviceV2 } from "../types";
import type { AdviceData } from "../types/shared/advice";
import { LANGUAGE_COLORS, DEFAULT_COLOR } from "../lib/language-colors";

// ── Compile-time assertion ────────────────────────────────────────────
// Ensures every key from the raw AI output (AdviceV2) is present in the
// enriched AdviceData. If a key is added to AdviceV2 but forgotten in
// AdviceData, TypeScript will report a type error here at build time.
type _AssertKeysPresent = { [K in keyof AdviceV2]: K extends keyof AdviceData ? true : never };

/**
 * Transform raw AI advice (`AdviceV2`) into the enriched `AdviceData`
 * payload consumed by the frontend.
 *
 * The main enrichment is on `repoImprovements`: each entry gets its
 * GitHub URL, primary language (with color), and star count looked up
 * from the user's `topRepositories`.
 *
 * All other fields are passed through unchanged via spread.
 *
 * @param ai     - Raw AI-generated advice (see `AdviceV2`)
 * @param github - GitHub profile/repo data used for enrichment
 * @returns        Enriched advice ready for the frontend (see `AdviceData`)
 */
export function buildAdviceData(ai: AdviceV2, github: GitHubUserData): AdviceData {
  const { topRepositories } = github;

  // Enrich repo improvements with URLs and language colors
  const repoImprovements = ai.repoImprovements.map((repo) => {
    const ghRepo = topRepositories.find(
      (r) => r.name.toLowerCase() === repo.repoName.toLowerCase(),
    );
    return {
      repoName: repo.repoName,
      repoUrl: ghRepo?.url ?? null,
      language: ghRepo?.language ?? null,
      languageColor: ghRepo?.language
        ? (LANGUAGE_COLORS as Record<string, string>)[ghRepo.language] || DEFAULT_COLOR
        : DEFAULT_COLOR,
      stars: ghRepo?.stars ?? 0,
      improvements: repo.improvements,
    };
  });

  return { ...ai, repoImprovements };
}

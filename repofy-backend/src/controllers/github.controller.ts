import { createHash } from "node:crypto";
import { RequestHandler } from "express";
import { env } from "../config/env";
import {
  fetchGitHubUserData,
  searchGitHubUsers,
} from "../services/github.service";
import { USERNAME_RE } from "../lib/validators";
import { TTLCache } from "../lib/ttl-cache";
import { sendError, sendSuccess } from "../lib/response";
import { handleControllerError } from "../lib/controller-utils";
import type { GitHubUserData } from "../types";

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 16);
}

/**
 * In-memory cache for GitHub user data — avoids 30+ API calls on repeat visits.
 * Per-process only; acceptable for a single Railway instance.
 *
 * TODO(scaling): If cache-hit ratio matters across replicas, consider a shared
 * Redis cache.
 */
const ghCache = new TTLCache<GitHubUserData>(128, 5 * 60 * 1000);

/** Clear the GitHub cache. Exposed for test isolation. */
export function clearGhCache(): void {
  ghCache.clear();
}

export const searchGitHub: RequestHandler = async (req, res) => {
  const rawQ = Array.isArray(req.query.q) ? req.query.q[0] : req.query.q;

  if (typeof rawQ !== "string") {
    sendError(res, 400, "Missing or invalid query parameter: q must be a string");
    return;
  }

  const q = rawQ.trim().slice(0, 256);

  if (!q) {
    sendSuccess(res, []);
    return;
  }

  try {
    if (env.mockAi) {
      const { buildMockSearchResults } = await import("../services/mock-ai.service");
      sendSuccess(res, buildMockSearchResults(q));
      return;
    }

    if (!req.githubToken) {
      sendError(res, 403, "GitHub authentication required. Please sign in again.");
      return;
    }

    const data = await searchGitHubUsers(q, req.signal, req.githubToken);
    sendSuccess(res, data);
  } catch (err) {
    handleControllerError(err, req, res, "GitHub Search", "Internal server error");
  }
};

export const getGitHubUser: RequestHandler = async (req, res) => {
  const username = req.params.username as string;

  if (!USERNAME_RE.test(username)) {
    sendError(res, 400, "Invalid GitHub username format");
    return;
  }

  try {
    if (env.mockAi) {
      const { buildMockGitHubData } = await import("../services/mock-ai.service");
      sendSuccess(res, buildMockGitHubData(username));
      return;
    }

    if (!req.githubToken) {
      sendError(res, 403, "GitHub authentication required. Please sign in again.");
      return;
    }

    // Key includes a token suffix so different users' tokens produce separate
    // cache entries — prevents leaking private GitHub data between users.
    const cacheKey = `${username.toLowerCase()}:${tokenHash(req.githubToken)}`;
    const cached = ghCache.get(cacheKey);
    if (cached) {
      sendSuccess(res, cached);
      return;
    }

    const data = await fetchGitHubUserData(username, req.signal, req.githubToken);
    ghCache.set(cacheKey, data);
    sendSuccess(res, data);
  } catch (err) {
    handleControllerError(err, req, res, "GitHub User", "Internal server error");
  }
};

import { RequestHandler } from "express";
import { env } from "../config/env";
import {
  fetchGitHubUserData,
  searchGitHubUsers,
} from "../services/github.service";
import { USERNAME_RE } from "../lib/validators";
import { sendError, sendSuccess } from "../lib/response";
import { handleControllerError } from "../lib/controller-utils";
import type { GitHubUserData } from "../types";

/**
 * In-memory cache for GitHub user data — avoids 30+ API calls on repeat visits.
 *
 * This is per-process only. In a multi-replica deployment each instance keeps
 * its own cache, which is acceptable (just causes extra GitHub API calls, not
 * incorrect behaviour). The cache is bounded by GITHUB_CACHE_MAX entries and
 * expired entries are swept every GITHUB_CACHE_TTL ms to prevent holding stale
 * data in memory.
 *
 * TODO(scaling): If cache-hit ratio matters across replicas, consider a shared
 * Redis cache. For a single Railway instance this is unnecessary.
 */
const GITHUB_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const GITHUB_CACHE_MAX = 128;

interface GHCacheEntry {
  data: GitHubUserData;
  storedAt: number;
}

const ghCache = new Map<string, GHCacheEntry>();

// Periodic sweep of expired entries so stale data doesn't linger in memory.
// The interval is unref'd so it won't keep the process alive during shutdown.
const ghCacheSweepInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of ghCache) {
    if (now - entry.storedAt > GITHUB_CACHE_TTL) ghCache.delete(key);
  }
}, GITHUB_CACHE_TTL);
ghCacheSweepInterval.unref();

function ghCacheGet(key: string): GitHubUserData | null {
  const entry = ghCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.storedAt > GITHUB_CACHE_TTL) {
    ghCache.delete(key);
    return null;
  }
  return entry.data;
}

/** Clear the GitHub cache. Exposed for test isolation. */
export function clearGhCache(): void {
  ghCache.clear();
}

function ghCacheSet(key: string, data: GitHubUserData): void {
  if (ghCache.size >= GITHUB_CACHE_MAX) {
    const oldest = ghCache.keys().next().value;
    if (oldest !== undefined) ghCache.delete(oldest);
  }
  ghCache.set(key, { data, storedAt: Date.now() });
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

    const data = await searchGitHubUsers(q, req.signal);
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

    const cached = ghCacheGet(username.toLowerCase());
    if (cached) {
      sendSuccess(res, cached);
      return;
    }

    const data = await fetchGitHubUserData(username, req.signal);
    ghCacheSet(username.toLowerCase(), data);
    sendSuccess(res, data);
  } catch (err) {
    handleControllerError(err, req, res, "GitHub User", "Internal server error");
  }
};

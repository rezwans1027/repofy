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

// In-memory cache for GitHub user data — avoids 30+ API calls on repeat visits
const GITHUB_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const GITHUB_CACHE_MAX = 128;

interface GHCacheEntry {
  data: GitHubUserData;
  storedAt: number;
}

const ghCache = new Map<string, GHCacheEntry>();

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
  const rawQ = req.query.q;
  const q = (Array.isArray(rawQ) ? rawQ[0] : rawQ || "").toString().trim().slice(0, 256);

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

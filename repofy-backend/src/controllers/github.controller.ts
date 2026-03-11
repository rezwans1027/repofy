import { RequestHandler } from "express";
import { env } from "../config/env";
import {
  fetchGitHubUserData,
  searchGitHubUsers,
} from "../services/github.service";
import { USERNAME_RE } from "../lib/validators";
import { sendError, sendSuccess } from "../lib/response";
import { handleControllerError } from "../lib/controller-utils";

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

    const data = await fetchGitHubUserData(username, req.signal);
    sendSuccess(res, data);
  } catch (err) {
    handleControllerError(err, req, res, "GitHub User", "Internal server error");
  }
};

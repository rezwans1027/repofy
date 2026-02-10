import { RequestHandler } from "express";
import {
  fetchGitHubUserData,
  searchGitHubUsers,
  GitHubError,
} from "../services/github.service";
import { USERNAME_RE } from "../lib/validators";
import { sendError, sendSuccess } from "../lib/response";
import { logger } from "../lib/logger";

export const searchGitHub: RequestHandler = async (req, res) => {
  const rawQ = req.query.q;
  const q = (Array.isArray(rawQ) ? rawQ[0] : rawQ || "").toString().trim();

  if (!q) {
    sendSuccess(res, []);
    return;
  }

  try {
    const data = await searchGitHubUsers(q, req.signal);
    sendSuccess(res, data);
  } catch (err) {
    if (err instanceof GitHubError) {
      sendError(res, err.statusCode, err.message);
      return;
    }
    logger.error("searchGitHub unexpected error:", err);
    sendError(res, 500, "Internal server error");
  }
};

export const getGitHubUser: RequestHandler = async (req, res) => {
  const username = req.params.username as string;

  if (!USERNAME_RE.test(username)) {
    sendError(res, 400, "Invalid GitHub username format");
    return;
  }

  try {
    const data = await fetchGitHubUserData(username, req.signal);
    sendSuccess(res, data);
  } catch (err) {
    if (err instanceof GitHubError) {
      sendError(res, err.statusCode, err.message);
      return;
    }
    logger.error("getGitHubUser unexpected error:", err);
    sendError(res, 500, "Internal server error");
  }
};

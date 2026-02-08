import { RequestHandler } from "express";
import { ApiResponse, GitHubUserData, GitHubSearchResult } from "../types";
import {
  fetchGitHubUserData,
  searchGitHubUsers,
  GitHubError,
} from "../services/github.service";

const USERNAME_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;

export const searchGitHub: RequestHandler = async (req, res) => {
  const q = (req.query.q as string || "").trim();

  if (!q) {
    const response: ApiResponse<GitHubSearchResult[]> = {
      success: true,
      data: [],
    };
    res.json(response);
    return;
  }

  try {
    const data = await searchGitHubUsers(q);
    const response: ApiResponse<GitHubSearchResult[]> = {
      success: true,
      data,
    };
    res.json(response);
  } catch (err) {
    if (err instanceof GitHubError) {
      const response: ApiResponse = {
        success: false,
        error: err.message,
      };
      res.status(err.statusCode).json(response);
      return;
    }
    console.error("searchGitHub unexpected error:", err);
    const response: ApiResponse = {
      success: false,
      error: "Internal server error",
    };
    res.status(500).json(response);
  }
};

export const getGitHubUser: RequestHandler = async (req, res) => {
  const username = req.params.username as string;

  if (!USERNAME_RE.test(username)) {
    const response: ApiResponse = {
      success: false,
      error: "Invalid GitHub username format",
    };
    res.status(400).json(response);
    return;
  }

  try {
    const data = await fetchGitHubUserData(username);
    const response: ApiResponse<GitHubUserData> = {
      success: true,
      data,
    };
    res.json(response);
  } catch (err) {
    if (err instanceof GitHubError) {
      const response: ApiResponse = {
        success: false,
        error: err.message,
      };
      res.status(err.statusCode).json(response);
      return;
    }
    console.error("getGitHubUser unexpected error:", err);
    const response: ApiResponse = {
      success: false,
      error: "Internal server error",
    };
    res.status(500).json(response);
  }
};

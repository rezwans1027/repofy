import { describe, it, expect, vi, beforeEach } from "vitest";
import { createControllerMocks } from "../../helpers/controller-mocks";

vi.mock("../../../src/services/github.service", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../../src/services/github.service")>();
  return {
    ...original,
    searchGitHubUsers: vi.fn(),
    fetchGitHubUserData: vi.fn(),
  };
});
vi.mock("../../../src/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { searchGitHub, getGitHubUser, clearGhCache } from "../../../src/controllers/github.controller";
import {
  searchGitHubUsers,
  fetchGitHubUserData,
  GitHubError,
} from "../../../src/services/github.service";

const mockSearchGitHubUsers = searchGitHubUsers as ReturnType<typeof vi.fn>;
const mockFetchGitHubUserData = fetchGitHubUserData as ReturnType<typeof vi.fn>;

describe("searchGitHub controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array for empty query", async () => {
    const { req, res, next } = createControllerMocks({}, { q: "" });

    await searchGitHub(req, res, next);

    expect(res.json).toHaveBeenCalledWith({ success: true, data: [] });
    expect(mockSearchGitHubUsers).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("trims whitespace from query", async () => {
    const results = [{ username: "octocat" }];
    mockSearchGitHubUsers.mockResolvedValue(results);
    const { req, res, next } = createControllerMocks({}, { q: "  octocat  " });

    await searchGitHub(req, res, next);

    expect(mockSearchGitHubUsers).toHaveBeenCalledWith(
      "octocat",
      expect.any(AbortSignal),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("returns search results on happy path", async () => {
    const results = [{ username: "octocat" }];
    mockSearchGitHubUsers.mockResolvedValue(results);
    const { req, res, next } = createControllerMocks({}, { q: "octocat" });

    await searchGitHub(req, res, next);

    expect(res.json).toHaveBeenCalledWith({ success: true, data: results });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns nothing when signal is aborted", async () => {
    mockSearchGitHubUsers.mockRejectedValue(new Error("aborted"));
    const { req, res, next, abortController } = createControllerMocks({}, { q: "octocat" });
    abortController.abort();

    await searchGitHub(req, res, next);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("handles GitHubError with correct status", async () => {
    mockSearchGitHubUsers.mockRejectedValue(
      new GitHubError("rate limit exceeded", 429),
    );
    const { req, res, next } = createControllerMocks({}, { q: "octocat" });

    await searchGitHub(req, res, next);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "rate limit exceeded",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("handles generic error with 500", async () => {
    mockSearchGitHubUsers.mockRejectedValue(new Error("boom"));
    const { req, res, next } = createControllerMocks({}, { q: "octocat" });

    await searchGitHub(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Internal server error",
    });
    expect(next).not.toHaveBeenCalled();
  });
});

describe("getGitHubUser controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearGhCache();
  });

  it("returns 400 for invalid username", async () => {
    const { req, res, next } = createControllerMocks({ username: "-invalid" });

    await getGitHubUser(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Invalid GitHub username format",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns user data on happy path", async () => {
    const userData = { profile: { username: "octocat" } };
    mockFetchGitHubUserData.mockResolvedValue(userData);
    const { req, res, next } = createControllerMocks({ username: "octocat" });

    await getGitHubUser(req, res, next);

    expect(res.json).toHaveBeenCalledWith({ success: true, data: userData });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns nothing when signal is aborted", async () => {
    mockFetchGitHubUserData.mockRejectedValue(new Error("aborted"));
    const { req, res, next, abortController } = createControllerMocks({ username: "octocat" });
    abortController.abort();

    await getGitHubUser(req, res, next);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("handles GitHubError with correct status", async () => {
    mockFetchGitHubUserData.mockRejectedValue(
      new GitHubError("User not found", 404),
    );
    const { req, res, next } = createControllerMocks({ username: "octocat" });

    await getGitHubUser(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "User not found",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("handles generic error with 500", async () => {
    mockFetchGitHubUserData.mockRejectedValue(new Error("boom"));
    const { req, res, next } = createControllerMocks({ username: "octocat" });

    await getGitHubUser(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Internal server error",
    });
    expect(next).not.toHaveBeenCalled();
  });
});

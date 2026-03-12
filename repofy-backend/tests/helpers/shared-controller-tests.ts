import { describe, it, expect, vi } from "vitest";
import type { RequestHandler } from "express";
import { createControllerMocks } from "./controller-mocks";

interface ControllerBehaviorConfig {
  handler: RequestHandler;
  mockFetchGitHubUserData: ReturnType<typeof vi.fn>;
  mockEnv: Record<string, unknown>;
  GitHubError: new (message: string, status: number) => Error;
}

export function sharedControllerBehaviorTests(config: ControllerBehaviorConfig) {
  const { handler, mockFetchGitHubUserData, mockEnv, GitHubError } = config;

  it("returns 400 for invalid username", async () => {
    const { req, res, next } = createControllerMocks({ username: "-invalid" });

    await handler(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Invalid GitHub username format",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns early when signal is aborted", async () => {
    mockFetchGitHubUserData.mockRejectedValue(new Error("aborted"));
    const { req, res, next, abortController } = createControllerMocks();
    abortController.abort();

    await handler(req, res, next);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("handles GitHubError with correct status", async () => {
    mockFetchGitHubUserData.mockRejectedValue(
      new GitHubError("User not found", 404),
    );
    const { req, res, next } = createControllerMocks();

    await handler(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "User not found",
    });
    expect(next).not.toHaveBeenCalled();
  });
}

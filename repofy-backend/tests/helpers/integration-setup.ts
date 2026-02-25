import { vi } from "vitest";
import {
  createGitHubApiUser,
  createGitHubApiRepo,
  createGitHubApiEvent,
  createContributionResponse,
} from "../fixtures/github";
import { getMockCreate } from "./mock-openai";

export function mockFetchJson(data: unknown, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
    headers: new Headers(),
    statusText: ok ? "OK" : "Error",
  });
}

export function setupGitHubMocks(fetchMock: ReturnType<typeof vi.fn>, username = "octocat") {
  const user = createGitHubApiUser({ login: username, name: username === "octocat" ? "The Octocat" : username });
  const repos = [createGitHubApiRepo()];
  const events = [createGitHubApiEvent("PushEvent")];
  const contributions = createContributionResponse();

  const reposRe = new RegExp(`/users/${username}/repos`);
  const eventsRe = new RegExp(`/users/${username}/events`);
  const userRe = new RegExp(`/users/${username}$`);

  fetchMock.mockImplementation((url: string) => {
    const urlStr = url.toString();
    if (urlStr.includes("/graphql")) return mockFetchJson(contributions);
    if (reposRe.test(urlStr)) return mockFetchJson(repos);
    if (eventsRe.test(urlStr)) return mockFetchJson(events);
    if (userRe.test(urlStr)) return mockFetchJson(user);
    return mockFetchJson({}, false, 404);
  });
}

export async function setupAuthMock(valid = true) {
  const { getSupabaseAdmin } = await import("../../src/config/supabase");
  const mockGetUser = vi.fn().mockResolvedValue(
    valid
      ? { data: { user: { id: "test-id", email: "test@test.com" } }, error: null }
      : { data: { user: null }, error: { message: "Invalid token" } },
  );
  (getSupabaseAdmin as ReturnType<typeof vi.fn>).mockReturnValue({
    auth: { getUser: mockGetUser },
    rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
  });
}

export async function setupOpenAIMock(responseFactory: () => unknown) {
  const mockCreate = await getMockCreate();
  mockCreate.mockResolvedValue({
    choices: [{ message: { content: JSON.stringify(responseFactory()) } }],
  });
  return mockCreate;
}

/**
 * Build a minimal Express app with a 50ms timeout for abort/timeout tests.
 * Avoids duplicating the middleware wiring across integration test files.
 */
export async function createShortTimeoutApp(
  method: "get" | "post" | "put" | "delete",
  path: string,
  handler: import("express").RequestHandler,
) {
  const express = (await import("express")).default;
  const { timeout: timeoutMw } = await import("../../src/middleware/timeout");
  const { requireAuth } = await import("../../src/middleware/auth");
  const { asyncHandler } = await import("../../src/middleware/asyncHandler");
  const { errorHandler } = await import("../../src/middleware/errorHandler");

  const app = express();
  app.use(express.json());
  app[method](path, timeoutMw(50), requireAuth, asyncHandler(handler));
  app.use(errorHandler);
  return app;
}

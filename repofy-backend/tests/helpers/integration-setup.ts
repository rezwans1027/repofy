import { vi } from "vitest";
import {
  createGitHubApiUser,
  createGitHubApiRepo,
  createGitHubApiEvent,
  createContributionResponse,
} from "../fixtures/github";
import { createScorerResponse, createScoringResult, createAdviceV2Response } from "../fixtures/ai";

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

/** Build a chainable Supabase mock for .from().select().eq().single() / .upsert() / .delete().lt() */
function createSupabaseChainMock() {
  const creditData = { data: { id: "mock-id", growth_balance: 5, eval_balance: 0 }, error: null };
  const upsertData = { data: { id: "advice-row-1" }, error: null };
  const empty = { data: null, error: null };
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  // Terminal for select→eq→single (cache lookups): return empty (cache miss)
  chain.single = vi.fn().mockResolvedValue(empty);
  // Terminal for select→eq→maybeSingle (credit balance): return credit data
  chain.maybeSingle = vi.fn().mockResolvedValue(creditData);
  chain.eq = vi.fn().mockReturnValue({ single: chain.single, maybeSingle: chain.maybeSingle });
  chain.lt = vi.fn().mockResolvedValue(empty);
  chain.select = vi.fn().mockReturnValue({ eq: chain.eq, single: chain.single });
  // upsert chain returns advice row id via its own single terminal
  const upsertSingle = vi.fn().mockResolvedValue(upsertData);
  const upsertSelect = vi.fn().mockReturnValue({ single: upsertSingle });
  chain.upsert = vi.fn().mockReturnValue({ select: upsertSelect });
  chain.delete = vi.fn().mockReturnValue({ lt: chain.lt });
  chain.from = vi.fn().mockReturnValue({
    select: chain.select,
    upsert: chain.upsert,
    delete: chain.delete,
  });
  return chain;
}

export async function setupAuthMock(valid = true) {
  const { getSupabaseAdmin } = await import("../../src/config/supabase");
  const mockGetUser = vi.fn().mockResolvedValue(
    valid
      ? { data: { user: { id: "test-id", email: "test@test.com" } }, error: null }
      : { data: { user: null }, error: { message: "Invalid token" } },
  );
  const dbChain = createSupabaseChainMock();
  (getSupabaseAdmin as ReturnType<typeof vi.fn>).mockReturnValue({
    auth: { getUser: mockGetUser },
    rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
    from: dbChain.from,
  });
}

/**
 * Wraps the current fetchMock implementation to also handle engine /analyze calls.
 * Must be called AFTER setupGitHubMocks.
 */
export function setupEngineAnalyzeMock(fetchMock: ReturnType<typeof vi.fn>) {
  const narrativeReport = [
    "A capable developer with a solid foundation in software engineering. Their profile demonstrates consistent effort across multiple projects.",
    "Their work shows clean code practices and thoughtful architecture. The repository structure reflects someone who takes pride in organized, maintainable code. Testing coverage varies across projects but shows awareness of quality practices.",
    "Some areas could benefit from more attention, particularly around CI/CD and documentation. Confidence in this assessment is moderate given the available data. Based on the evidence reviewed, the overall recommendation is reasonable for this candidate's level.",
  ].join("\n\n");

  const engineResponse = {
    scorerResponse: createScorerResponse(),
    scoringResult: createScoringResult(),
    narrativeReport,
    tokenUsage: [],
  };

  wrapFetchMockForEngine(fetchMock, "/analyze", engineResponse);
}

/**
 * Wraps the current fetchMock implementation to also handle engine /advice calls.
 * Must be called AFTER setupGitHubMocks.
 */
export function setupEngineAdviceMock(fetchMock: ReturnType<typeof vi.fn>) {
  const engineResponse = {
    advice: createAdviceV2Response(),
    tokenUsage: [],
  };

  wrapFetchMockForEngine(fetchMock, "/advice", engineResponse);
}

function wrapFetchMockForEngine(
  fetchMock: ReturnType<typeof vi.fn>,
  path: string,
  response: object,
) {
  const prevImpl = fetchMock.getMockImplementation();
  fetchMock.mockImplementation((url: string, ...args: unknown[]) => {
    const urlStr = url.toString();
    // Match engine calls (localhost:3002 or railway.internal) but not GitHub API
    if (urlStr.includes(path) && !urlStr.includes("github.com")) {
      return mockFetchJson(response);
    }
    return prevImpl ? prevImpl(url, ...args) : mockFetchJson({}, false, 404);
  });
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

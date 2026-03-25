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

/** Build a chainable Supabase mock for .from().select().eq().single() / .insert() / .upsert() / .delete().lt() */
function createSupabaseChainMock() {
  const creditData = { data: { id: "mock-id", growth_balance: 5, eval_balance: 0 }, error: null };
  const githubTokenData = { data: { github_token: "fake-github-token" }, error: null };
  const upsertData = { data: { id: "advice-row-1", created_at: "2026-03-21T10:00:00Z", updated_at: "2026-03-21T10:00:00Z" }, error: null };
  const empty = { data: null, error: null };

  // Create table-aware mock chains
  function createTableChain(tableName: string) {
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    chain.single = vi.fn().mockResolvedValue(empty);
    // maybeSingle returns different data depending on the table
    if (tableName === "github_tokens") {
      chain.maybeSingle = vi.fn().mockResolvedValue(githubTokenData);
    } else if (tableName === "advice_jobs") {
      chain.maybeSingle = vi.fn().mockResolvedValue(empty); // no active job by default
    } else {
      chain.maybeSingle = vi.fn().mockResolvedValue(creditData);
    }
    // Make eq/order/limit/in chainable — each returns the full query chain
    // Use mockImplementation with lazy access so circular refs work
    const queryResult = () => ({
      eq: chain.eq, single: chain.single, maybeSingle: chain.maybeSingle,
      order: chain.order, limit: chain.limit, in: chain.in, lt: chain.lt,
    });
    chain.eq = vi.fn().mockImplementation(() => queryResult());
    chain.order = vi.fn().mockImplementation(() => queryResult());
    chain.limit = vi.fn().mockImplementation(() => queryResult());
    chain.in = vi.fn().mockImplementation(() => queryResult());
    chain.lt = vi.fn().mockResolvedValue(empty);
    chain.select = vi.fn().mockImplementation(() => ({ eq: chain.eq, single: chain.single, order: chain.order }));
    const insertSingle = vi.fn().mockResolvedValue(upsertData);
    const insertSelect = vi.fn().mockReturnValue({ single: insertSingle });
    chain.insert = vi.fn().mockReturnValue({ select: insertSelect });
    const upsertSingle = vi.fn().mockResolvedValue(upsertData);
    const upsertSelect = vi.fn().mockReturnValue({ single: upsertSingle });
    chain.upsert = vi.fn().mockReturnValue({ select: upsertSelect });
    chain.update = vi.fn().mockImplementation(() => {
      const updateChain: Record<string, ReturnType<typeof vi.fn>> = {};
      const updateResult = (): Record<string, ReturnType<typeof vi.fn>> => ({
        eq: updateChain.eq, lt: updateChain.lt,
      });
      updateChain.eq = vi.fn().mockImplementation(() => updateResult());
      updateChain.lt = vi.fn().mockResolvedValue(empty);
      return updateResult();
    });
    chain.delete = vi.fn().mockImplementation(() => ({ lt: chain.lt, in: chain.in, eq: chain.eq }));
    return chain;
  }

  const fromMock = vi.fn().mockImplementation((tableName: string) => {
    const chain = createTableChain(tableName);
    return {
      select: chain.select,
      insert: chain.insert,
      upsert: chain.upsert,
      update: chain.update,
      delete: chain.delete,
    };
  });

  return { from: fromMock };
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

  // Clear the auth middleware token cache so fresh mocks take effect
  const { clearTokenCache } = await import("../../src/middleware/auth");
  clearTokenCache();
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

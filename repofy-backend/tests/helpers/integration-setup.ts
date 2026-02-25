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

/** Build a chainable Supabase mock for .from().select().eq().single() / .upsert() / .delete().lt() */
function createSupabaseChainMock() {
  const terminal = { data: null, error: null };
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.single = vi.fn().mockResolvedValue(terminal);
  chain.eq = vi.fn().mockReturnValue({ single: chain.single });
  chain.lt = vi.fn().mockResolvedValue(terminal);
  chain.select = vi.fn().mockReturnValue({ eq: chain.eq });
  chain.upsert = vi.fn().mockResolvedValue(terminal);
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
    from: dbChain.from,
  });
}

export async function setupOpenAIMock(responseFactory: () => unknown) {
  const mockCreate = await getMockCreate();
  mockCreate.mockImplementation((params: Record<string, unknown>) => {
    const messages = params.messages as { role: string; content: string }[] | undefined;
    const systemContent = messages?.[0]?.content ?? "";

    // Narrator call: return 3-paragraph prose ending with LOCKED_LINE extracted from user message
    if (systemContent.includes("professional hiring evaluation")) {
      const userContent = messages?.[1]?.content ?? "";
      const lockedMatch = userContent.match(/^(LOCKED: .+)$/m);
      const lockedLine = lockedMatch?.[1] ?? "";

      const prose = [
        "A capable developer with a solid foundation in software engineering. Their profile demonstrates consistent effort across multiple projects.",
        "Their work shows clean code practices and thoughtful architecture. The repository structure reflects someone who takes pride in organized, maintainable code. Testing coverage varies across projects but shows awareness of quality practices.",
        "Some areas could benefit from more attention, particularly around CI/CD and documentation. Confidence in this assessment is moderate given the available data. Based on the evidence reviewed, the overall recommendation is reasonable for this candidate's level.",
      ].join("\n\n");

      return Promise.resolve({
        choices: [{ message: { content: `${prose}\n${lockedLine}` } }],
      });
    }

    // Scorer / advice call: return JSON from the factory
    return Promise.resolve({
      choices: [{ message: { content: JSON.stringify(responseFactory()) } }],
    });
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

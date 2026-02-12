import { vi } from "vitest";
import {
  createGitHubApiUser,
  createGitHubApiRepo,
  createGitHubApiEvent,
  createContributionResponse,
} from "../fixtures/github";

export function mockFetchJson(data: unknown, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(data),
  });
}

export function setupGitHubMocks(fetchMock: ReturnType<typeof vi.fn>) {
  const user = createGitHubApiUser();
  const repos = [createGitHubApiRepo()];
  const events = [createGitHubApiEvent("PushEvent")];
  const contributions = createContributionResponse();

  fetchMock.mockImplementation((url: string) => {
    const urlStr = url.toString();
    if (urlStr.includes("/graphql")) return mockFetchJson(contributions);
    if (urlStr.includes("/users/octocat/repos")) return mockFetchJson(repos);
    if (urlStr.includes("/users/octocat/events")) return mockFetchJson(events);
    if (urlStr.includes("/users/octocat")) return mockFetchJson(user);
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
  });
}

export async function setupOpenAIMock(responseFactory: () => unknown) {
  const mod = await import("openai");
  const mockCreate = (mod as any).__mockCreate as ReturnType<typeof vi.fn>;
  mockCreate.mockResolvedValue({
    choices: [{ message: { content: JSON.stringify(responseFactory()) } }],
  });
  return mockCreate;
}

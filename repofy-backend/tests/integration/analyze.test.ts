import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { getApp } from "../helpers/supertest-app";
import {
  createGitHubApiUser,
  createGitHubApiRepo,
  createGitHubApiEvent,
  createContributionResponse,
} from "../fixtures/github";
import { createAIAnalysisResponse } from "../fixtures/ai";

// Mock fetch
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

// Mock openai
vi.mock("openai", () => {
  const mockCreate = vi.fn();
  return {
    default: class {
      chat = { completions: { create: mockCreate } };
    },
    __mockCreate: mockCreate,
  };
});

// Mock supabase
vi.mock("../../src/config/supabase", () => ({
  getSupabaseAdmin: vi.fn(),
}));

function mockFetchJson(data: unknown, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(data),
  });
}

function setupGitHubMocks() {
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

async function setupAuthMock(valid = true) {
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

async function setupOpenAIMock() {
  const mod = await import("openai");
  const mockCreate = (mod as any).__mockCreate as ReturnType<typeof vi.fn>;
  const analysisResponse = createAIAnalysisResponse();
  mockCreate.mockResolvedValue({
    choices: [{ message: { content: JSON.stringify(analysisResponse) } }],
  });
  return mockCreate;
}

describe("POST /api/analyze/:username", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("returns 200 with report data when authenticated", async () => {
    setupGitHubMocks();
    await setupAuthMock(true);
    await setupOpenAIMock();

    const app = getApp();
    const res = await request(app)
      .post("/api/analyze/octocat")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.analyzedName).toBe("The Octocat");
    expect(res.body.data.report).toBeDefined();
    expect(res.body.data.report.candidateLevel).toBe("Mid-Level");
  });

  it("returns 401 without auth", async () => {
    const app = getApp();
    const res = await request(app).post("/api/analyze/octocat");

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("returns 400 for invalid username", async () => {
    await setupAuthMock(true);

    const app = getApp();
    const res = await request(app)
      .post("/api/analyze/-invalid")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("returns error when GitHub fetch fails", async () => {
    await setupAuthMock(true);
    await setupOpenAIMock();
    fetchMock.mockReturnValue(
      Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) }),
    );

    const app = getApp();
    const res = await request(app)
      .post("/api/analyze/nonexistent")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

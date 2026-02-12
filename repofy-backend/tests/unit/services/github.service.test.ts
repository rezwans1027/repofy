import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createGitHubApiUser,
  createGitHubApiRepo,
  createGitHubApiRepoList,
  createGitHubApiEvent,
  createSearchResponse,
  createContributionResponse,
} from "../../fixtures/github";
import { mockFetchJson } from "../../helpers/integration-setup";

// We need to mock global.fetch before importing the service
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

// Import after stubbing fetch
import { searchGitHubUsers, fetchGitHubUserData, GitHubError } from "../../../src/services/github.service";

describe("github.service", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  describe("searchGitHubUsers", () => {
    it("returns mapped search results", async () => {
      const user = createGitHubApiUser({ login: "octocat" });
      const searchResp = createSearchResponse(["octocat"]);

      fetchMock
        .mockReturnValueOnce(mockFetchJson(searchResp))       // search endpoint
        .mockReturnValueOnce(mockFetchJson(user));              // individual user fetch

      const results = await searchGitHubUsers("octocat");

      expect(results).toHaveLength(1);
      expect(results[0].username).toBe("octocat");
      expect(results[0].name).toBe("The Octocat");
      expect(results[0].bio).toBe("GitHub mascot");
      expect(results[0].followers).toBe(1000);
    });

    it("returns empty array for empty search results", async () => {
      fetchMock.mockReturnValueOnce(mockFetchJson(createSearchResponse([])));

      const results = await searchGitHubUsers("nonexistent");

      expect(results).toHaveLength(0);
    });
  });

  describe("fetchGitHubUserData", () => {
    function setupFetchMocks(repos?: ReturnType<typeof createGitHubApiRepoList>) {
      const user = createGitHubApiUser();
      const repoList = repos ?? [createGitHubApiRepo()];
      const events = [
        createGitHubApiEvent("PushEvent"),
        createGitHubApiEvent("PullRequestEvent"),
        createGitHubApiEvent("IssuesEvent"),
        createGitHubApiEvent("PullRequestReviewEvent"),
      ];
      const contributions = createContributionResponse();

      fetchMock.mockImplementation((url: string) => {
        const urlStr = url.toString();
        if (urlStr.includes("/graphql")) {
          return mockFetchJson(contributions);
        }
        if (urlStr.includes("/users/octocat/repos")) {
          return mockFetchJson(repoList);
        }
        if (urlStr.includes("/users/octocat/events")) {
          return mockFetchJson(events);
        }
        if (urlStr.includes("/users/octocat")) {
          return mockFetchJson(user);
        }
        return mockFetchJson({}, false, 404);
      });

      return { user, repoList, events };
    }

    it("returns complete user data", async () => {
      setupFetchMocks();

      const data = await fetchGitHubUserData("octocat");

      expect(data.profile.username).toBe("octocat");
      expect(data.repositories).toHaveLength(1);
      expect(data.topRepositories).toHaveLength(1);
      expect(data.languages).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: expect.any(String), percentage: expect.any(Number) })]),
      );
      expect(data.activity).toMatchObject({
        totalEvents: expect.any(Number),
        pushEvents: expect.any(Number),
        prEvents: expect.any(Number),
      });
      expect(data.stats).toMatchObject({
        totalStars: expect.any(Number),
        totalForks: expect.any(Number),
        originalRepos: expect.any(Number),
      });
      expect(data.contributions).not.toBeNull();
    });

    it("maps profile fields correctly", async () => {
      setupFetchMocks();

      const data = await fetchGitHubUserData("octocat");

      expect(data.profile).toEqual({
        username: "octocat",
        name: "The Octocat",
        avatarUrl: "https://avatars.githubusercontent.com/u/583231",
        bio: "GitHub mascot",
        company: "@github",
        location: "San Francisco",
        blog: "https://github.blog",
        followers: 1000,
        following: 10,
        publicRepos: 8,
        createdAt: "2011-01-25T18:44:36Z",
      });
    });

    it("excludes forks from language breakdown", async () => {
      const repos = [
        createGitHubApiRepo({ name: "original", language: "TypeScript", fork: false }),
        createGitHubApiRepo({ name: "forked", language: "Python", fork: true }),
      ];
      setupFetchMocks(repos);

      const data = await fetchGitHubUserData("octocat");

      const langNames = data.languages.map((l) => l.name);
      expect(langNames).toContain("TypeScript");
      expect(langNames).not.toContain("Python");
    });

    it("calculates language percentages", async () => {
      const repos = [
        createGitHubApiRepo({ name: "ts1", language: "TypeScript", fork: false }),
        createGitHubApiRepo({ name: "ts2", language: "TypeScript", fork: false }),
        createGitHubApiRepo({ name: "js1", language: "JavaScript", fork: false }),
      ];
      setupFetchMocks(repos);

      const data = await fetchGitHubUserData("octocat");

      const tsLang = data.languages.find((l) => l.name === "TypeScript");
      const jsLang = data.languages.find((l) => l.name === "JavaScript");
      expect(tsLang!.percentage).toBeCloseTo(66.7, 0);
      expect(tsLang!.repoCount).toBe(2);
      expect(jsLang!.percentage).toBeCloseTo(33.3, 0);
      expect(jsLang!.repoCount).toBe(1);
    });

    it("counts event types correctly in activity summary", async () => {
      setupFetchMocks();

      const data = await fetchGitHubUserData("octocat");

      expect(data.activity.totalEvents).toBe(4);
      expect(data.activity.pushEvents).toBe(1);
      expect(data.activity.prEvents).toBe(1);
      expect(data.activity.issueEvents).toBe(1);
      expect(data.activity.reviewEvents).toBe(1);
      expect(data.activity.recentActiveRepos).toContain("octocat/cool-project");
    });

    it("calculates stats correctly", async () => {
      const repos = [
        createGitHubApiRepo({ stargazers_count: 10, forks_count: 2, fork: false }),
        createGitHubApiRepo({ name: "forked", stargazers_count: 5, forks_count: 1, fork: true }),
      ];
      setupFetchMocks(repos);

      const data = await fetchGitHubUserData("octocat");

      expect(data.stats.totalStars).toBe(15);
      expect(data.stats.totalForks).toBe(3);
      expect(data.stats.originalRepos).toBe(1);
      expect(data.stats.accountAgeDays).toBeGreaterThan(0);
    });
  });

  describe("GitHubError handling", () => {
    it("throws 'User not found' on 404", async () => {
      fetchMock.mockReturnValueOnce(
        Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) }),
      );

      await expect(searchGitHubUsers("nonexistent")).rejects.toThrow("User not found");
    });

    it("throws 'rate limit' on 403", async () => {
      fetchMock.mockReturnValueOnce(
        Promise.resolve({ ok: false, status: 403, json: () => Promise.resolve({}) }),
      );

      await expect(searchGitHubUsers("test")).rejects.toThrow("rate limit");
    });

    it("throws 'rate limit' on 429", async () => {
      fetchMock.mockReturnValueOnce(
        Promise.resolve({ ok: false, status: 429, json: () => Promise.resolve({}) }),
      );

      await expect(searchGitHubUsers("test")).rejects.toThrow("rate limit");
    });

    it("passes through status for other errors", async () => {
      fetchMock.mockReturnValueOnce(
        Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) }),
      );

      await expect(searchGitHubUsers("test")).rejects.toMatchObject({
        statusCode: 500,
      });
    });
  });

  describe("Pagination", () => {
    it("stops when batch length is less than perPage", async () => {
      const user = createGitHubApiUser({ public_repos: 150 });
      const batch = createGitHubApiRepoList(50); // less than 100 perPage
      const events = [createGitHubApiEvent("PushEvent")];
      const contributions = createContributionResponse();

      fetchMock.mockImplementation((url: string) => {
        const urlStr = url.toString();
        if (urlStr.includes("/graphql")) return mockFetchJson(contributions);
        if (urlStr.includes("/users/octocat/repos")) return mockFetchJson(batch);
        if (urlStr.includes("/users/octocat/events")) return mockFetchJson(events);
        if (urlStr.includes("/users/octocat")) return mockFetchJson(user);
        return mockFetchJson({}, false, 404);
      });

      const data = await fetchGitHubUserData("octocat");

      // Should only call repos once since batch < perPage
      const repoCalls = fetchMock.mock.calls.filter(
        (c) => c[0].toString().includes("/repos"),
      );
      expect(repoCalls).toHaveLength(1);
      expect(data.stats.reposTruncated).toBe(true); // 50 < 150 public_repos
    });
  });
});

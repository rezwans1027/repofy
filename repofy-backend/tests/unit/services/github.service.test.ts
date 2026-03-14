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
import { searchGitHubUsers, fetchGitHubUserData, GitHubError, detectSignals } from "../../../src/services/github.service";

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

    it("encodes special characters in search query", async () => {
      fetchMock.mockReturnValueOnce(mockFetchJson(createSearchResponse([])));

      await searchGitHubUsers("john doe");

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("john%20doe"),
        expect.anything(),
      );
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
      // Provide enough responses for retry attempts (fetchWithRetry retries 500s)
      const error500 = () =>
        Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) });
      fetchMock
        .mockReturnValueOnce(error500())
        .mockReturnValueOnce(error500())
        .mockReturnValueOnce(error500());

      await expect(searchGitHubUsers("test")).rejects.toMatchObject({
        statusCode: 500,
      });
    });
  });

  describe("detectSignals", () => {
    function makeEntry(path: string, type: "blob" | "tree" = "blob") {
      return { path, type, size: 100 };
    }

    it("detects selftests/ as tests", () => {
      const result = detectSignals([makeEntry("selftests/test_foo.c")]);
      expect(result.hasTests).toBe(true);
    });

    it("detects selftest/ as tests", () => {
      const result = detectSignals([makeEntry("selftest/run.sh")]);
      expect(result.hasTests).toBe(true);
    });

    it("detects tools/testing/ as tests", () => {
      const result = detectSignals([makeEntry("tools/testing/selftests/foo.c")]);
      expect(result.hasTests).toBe(true);
    });

    it("detects t/ (git convention) as tests when t/tNNNN files present", () => {
      const result = detectSignals([makeEntry("t", "tree"), makeEntry("t/t0001.sh")]);
      expect(result.hasTests).toBe(true);
    });

    it("does NOT detect t/ as tests without tNNNN naming pattern", () => {
      const result = detectSignals([makeEntry("t", "tree"), makeEntry("t/readme.md")]);
      expect(result.hasTests).toBe(false);
    });

    it("detects tox.ini as tests", () => {
      const result = detectSignals([makeEntry("tox.ini")]);
      expect(result.hasTests).toBe(true);
    });

    it("detects pytest.ini as tests", () => {
      const result = detectSignals([makeEntry("pytest.ini")]);
      expect(result.hasTests).toBe(true);
    });

    it("detects conftest.py as tests", () => {
      const result = detectSignals([makeEntry("conftest.py")]);
      expect(result.hasTests).toBe(true);
    });

    it("detects .buildkite/ as CI", () => {
      const result = detectSignals([makeEntry(".buildkite/pipeline.yml")]);
      expect(result.hasCI).toBe(true);
    });

    it("detects azure-pipelines.yml as CI", () => {
      const result = detectSignals([makeEntry("azure-pipelines.yml")]);
      expect(result.hasCI).toBe(true);
    });

    it("detects appveyor.yml as CI", () => {
      const result = detectSignals([makeEntry("appveyor.yml")]);
      expect(result.hasCI).toBe(true);
    });

    it("detects .appveyor.yml as CI", () => {
      const result = detectSignals([makeEntry(".appveyor.yml")]);
      expect(result.hasCI).toBe(true);
    });

    it("detects .drone.yml as CI", () => {
      const result = detectSignals([makeEntry(".drone.yml")]);
      expect(result.hasCI).toBe(true);
    });

    it("detects bitbucket-pipelines.yml as CI", () => {
      const result = detectSignals([makeEntry("bitbucket-pipelines.yml")]);
      expect(result.hasCI).toBe(true);
    });

    it("detects .clang-format as lint config", () => {
      const result = detectSignals([makeEntry(".clang-format")]);
      expect(result.hasLintConfig).toBe(true);
    });

    it("detects .clang-tidy as lint config", () => {
      const result = detectSignals([makeEntry(".clang-tidy")]);
      expect(result.hasLintConfig).toBe(true);
    });

    it("detects .editorconfig as lint config", () => {
      const result = detectSignals([makeEntry(".editorconfig")]);
      expect(result.hasLintConfig).toBe(true);
    });

    it("detects checkpatch.pl as lint config", () => {
      const result = detectSignals([makeEntry("checkpatch.pl")]);
      expect(result.hasLintConfig).toBe(true);
    });

    it("detects scripts/checkpatch as lint config", () => {
      const result = detectSignals([makeEntry("scripts/checkpatch")]);
      expect(result.hasLintConfig).toBe(true);
    });

    it("detects pyproject.toml as lint config", () => {
      const result = detectSignals([makeEntry("pyproject.toml")]);
      expect(result.hasLintConfig).toBe(true);
    });

    it("detects .golangci.yml as lint config", () => {
      const result = detectSignals([makeEntry(".golangci.yml")]);
      expect(result.hasLintConfig).toBe(true);
    });

    it("detects rustfmt.toml as lint config", () => {
      const result = detectSignals([makeEntry("rustfmt.toml")]);
      expect(result.hasLintConfig).toBe(true);
    });

    it("detects clippy.toml as lint config", () => {
      const result = detectSignals([makeEntry("clippy.toml")]);
      expect(result.hasLintConfig).toBe(true);
    });

    it("detects Makefile as build system", () => {
      const result = detectSignals([makeEntry("Makefile")]);
      expect(result.hasBuildSystem).toBe(true);
    });

    it("detects CMakeLists.txt as build system", () => {
      const result = detectSignals([makeEntry("CMakeLists.txt")]);
      expect(result.hasBuildSystem).toBe(true);
    });

    it("detects meson.build as build system", () => {
      const result = detectSignals([makeEntry("meson.build")]);
      expect(result.hasBuildSystem).toBe(true);
    });

    it("detects build.gradle as build system", () => {
      const result = detectSignals([makeEntry("build.gradle")]);
      expect(result.hasBuildSystem).toBe(true);
    });

    it("detects pom.xml as build system", () => {
      const result = detectSignals([makeEntry("pom.xml")]);
      expect(result.hasBuildSystem).toBe(true);
    });

    it("detects build.zig as build system", () => {
      const result = detectSignals([makeEntry("build.zig")]);
      expect(result.hasBuildSystem).toBe(true);
    });

    it("detects .bazelrc as build system", () => {
      const result = detectSignals([makeEntry(".bazelrc")]);
      expect(result.hasBuildSystem).toBe(true);
    });

    it("detects BUILD.bazel as build system", () => {
      const result = detectSignals([makeEntry("BUILD.bazel")]);
      expect(result.hasBuildSystem).toBe(true);
    });

    it("detects WORKSPACE as build system only with Bazel co-indicator", () => {
      const result = detectSignals([makeEntry("WORKSPACE"), makeEntry(".bazelrc")]);
      expect(result.hasBuildSystem).toBe(true);
    });

    it("does NOT detect standalone WORKSPACE as build system", () => {
      const result = detectSignals([makeEntry("WORKSPACE")]);
      expect(result.hasBuildSystem).toBe(false);
    });

    it("detects configure.ac as build system", () => {
      const result = detectSignals([makeEntry("configure.ac")]);
      expect(result.hasBuildSystem).toBe(true);
    });

    it("does NOT detect bare configure as build system", () => {
      const result = detectSignals([makeEntry("configure")]);
      expect(result.hasBuildSystem).toBe(false);
    });

    it("detects Kbuild as build system", () => {
      const result = detectSignals([makeEntry("Kbuild")]);
      expect(result.hasBuildSystem).toBe(true);
    });

    it("detects Kconfig as build system", () => {
      const result = detectSignals([makeEntry("Kconfig")]);
      expect(result.hasBuildSystem).toBe(true);
    });

    // Nested path detection
    it("detects nested Makefile (src/Makefile)", () => {
      const result = detectSignals([makeEntry("src/Makefile")]);
      expect(result.hasBuildSystem).toBe(true);
    });

    it("detects nested CMakeLists.txt (subproject/CMakeLists.txt)", () => {
      const result = detectSignals([makeEntry("subproject/CMakeLists.txt")]);
      expect(result.hasBuildSystem).toBe(true);
    });

    it("detects deeply nested build.gradle", () => {
      const result = detectSignals([makeEntry("app/src/build.gradle")]);
      expect(result.hasBuildSystem).toBe(true);
    });

    // False positive rejection
    it("does NOT detect makefile.bak as build system", () => {
      const result = detectSignals([makeEntry("makefile.bak")]);
      expect(result.hasBuildSystem).toBe(false);
    });

    it("does NOT detect CMakeLists.txt.old as build system", () => {
      const result = detectSignals([makeEntry("CMakeLists.txt.old")]);
      expect(result.hasBuildSystem).toBe(false);
    });

    it("does NOT detect workspace.md as build system", () => {
      const result = detectSignals([makeEntry("workspace.md")]);
      expect(result.hasBuildSystem).toBe(false);
    });

    // Segment-boundary test detection
    it("does NOT detect contest/ as tests (false positive)", () => {
      const result = detectSignals([makeEntry("contest/problem1.py")]);
      expect(result.hasTests).toBe(false);
    });

    it("detects nested test/ directory", () => {
      const result = detectSignals([makeEntry("packages/core/test/unit.spec.ts")]);
      expect(result.hasTests).toBe(true);
    });

    // Nested lint config detection
    it("detects nested .eslintrc.json (packages/api/.eslintrc.json)", () => {
      const result = detectSignals([makeEntry("packages/api/.eslintrc.json")]);
      expect(result.hasLintConfig).toBe(true);
    });

    it("detects nested pyproject.toml", () => {
      const result = detectSignals([makeEntry("backend/pyproject.toml")]);
      expect(result.hasLintConfig).toBe(true);
    });

    it("detects nested .clang-format", () => {
      const result = detectSignals([makeEntry("lib/src/.clang-format")]);
      expect(result.hasLintConfig).toBe(true);
    });

    it("existing test patterns still work", () => {
      const result = detectSignals([
        makeEntry("src/index.ts"),
        makeEntry("tests/unit/foo.test.ts"),
        makeEntry(".github/workflows/ci.yml"),
        makeEntry(".eslintrc.json"),
        makeEntry("Dockerfile"),
      ]);
      expect(result.hasTests).toBe(true);
      expect(result.hasCI).toBe(true);
      expect(result.hasLintConfig).toBe(true);
      expect(result.hasDockerfile).toBe(true);
      expect(result.hasBuildSystem).toBe(false);
    });

    it("returns false for all signals with empty entries", () => {
      const result = detectSignals([]);
      expect(result.hasTests).toBe(false);
      expect(result.hasCI).toBe(false);
      expect(result.hasLintConfig).toBe(false);
      expect(result.hasDockerfile).toBe(false);
      expect(result.hasBuildSystem).toBe(false);
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

      // Should only call repos listing once since batch < perPage
      const repoCalls = fetchMock.mock.calls.filter(
        (c) => c[0].toString().includes("/users/octocat/repos"),
      );
      expect(repoCalls).toHaveLength(1);
      expect(data.stats.reposTruncated).toBe(true); // 50 < 150 public_repos
    });

    it("fetches multiple pages when batch equals perPage", async () => {
      const user = createGitHubApiUser({ public_repos: 150 });
      const fullBatch = createGitHubApiRepoList(100); // exactly perPage → triggers next page
      const partialBatch = createGitHubApiRepoList(50); // second page, less than perPage → stops
      const events = [createGitHubApiEvent("PushEvent")];
      const contributions = createContributionResponse();

      fetchMock.mockImplementation((url: string) => {
        const urlStr = url.toString();
        if (urlStr.includes("/graphql")) return mockFetchJson(contributions);
        if (urlStr.includes("/users/octocat/repos")) {
          if (urlStr.includes("page=2")) return mockFetchJson(partialBatch);
          // First page returns Link header so parallel fetcher knows total pages
          const headers = new Headers();
          headers.set("link", '<https://api.github.com/users/octocat/repos?page=2>; rel="last"');
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(fullBatch),
            text: () => Promise.resolve(JSON.stringify(fullBatch)),
            headers,
            statusText: "OK",
          });
        }
        if (urlStr.includes("/users/octocat/events")) return mockFetchJson(events);
        if (urlStr.includes("/users/octocat")) return mockFetchJson(user);
        return mockFetchJson({}, false, 404);
      });

      const data = await fetchGitHubUserData("octocat");

      const repoCalls = fetchMock.mock.calls.filter(
        (c) => c[0].toString().includes("/users/octocat/repos"),
      );
      expect(repoCalls).toHaveLength(2);
      expect(data.repositories).toHaveLength(150);
    });
  });
});

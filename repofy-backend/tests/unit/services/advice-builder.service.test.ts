import { describe, it, expect } from "vitest";
import { createGitHubUserData } from "../../fixtures/github";
import { createAdviceV2Response } from "../../fixtures/ai";
import type { GitHubRepo } from "../../../src/types";
import { LANGUAGE_COLORS, DEFAULT_COLOR } from "../../../src/lib/language-colors";
import { buildAdviceData } from "../../../src/services/advice-builder.service";

describe("buildAdviceData", () => {
  it("matches repos case-insensitively", () => {
    const topRepos: GitHubRepo[] = [
      {
        name: "Cool-Project",
        fullName: "octocat/Cool-Project",
        description: "Cool desc",
        url: "https://github.com/octocat/Cool-Project",
        homepage: null,
        language: "TypeScript",
        stars: 42,
        forks: 5,
        watchers: 42,
        openIssues: 0,
        isFork: false,
        isArchived: false,
        topics: [],
        createdAt: "2020-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
        pushedAt: "2024-01-01T00:00:00Z",
      },
    ];
    const ai = createAdviceV2Response({
      repoImprovements: [
        {
          repoName: "cool-project",
          improvements: [{ area: "Testing", suggestion: "Add tests.", priority: "High", expectedOutcome: "Coverage." }],
        },
      ],
    });

    const github = createGitHubUserData({ topRepositories: topRepos });
    const result = buildAdviceData(ai, github);

    expect(result.repoImprovements[0].repoUrl).toBe("https://github.com/octocat/Cool-Project");
    expect(result.repoImprovements[0].language).toBe("TypeScript");
    expect(result.repoImprovements[0].languageColor).toBe(LANGUAGE_COLORS["TypeScript"]);
    expect(result.repoImprovements[0].stars).toBe(42);
  });

  it("falls back for unmatched repos", () => {
    const ai = createAdviceV2Response({
      repoImprovements: [
        {
          repoName: "nonexistent",
          improvements: [{ area: "Testing", suggestion: "Add tests.", priority: "High", expectedOutcome: "Coverage." }],
        },
      ],
    });

    const github = createGitHubUserData({ topRepositories: [] });
    const result = buildAdviceData(ai, github);

    expect(result.repoImprovements[0].repoUrl).toBeNull();
    expect(result.repoImprovements[0].language).toBeNull();
    expect(result.repoImprovements[0].languageColor).toBe(DEFAULT_COLOR);
    expect(result.repoImprovements[0].stars).toBe(0);
  });

  it("preserves v2 AI fields", () => {
    const ai = createAdviceV2Response();
    const github = createGitHubUserData();

    const result = buildAdviceData(ai, github);

    expect(result.schemaVersion).toBe("v2");
    expect(result.generationWarnings).toEqual([]);
    expect(result.summary).toBe(ai.summary);
    expect(result.trajectory).toEqual(ai.trajectory);
    expect(result.buildRoadmap).toEqual(ai.buildRoadmap);
    expect(result.skillRoadmap).toEqual(ai.skillRoadmap);
    expect(result.contributionStrategy).toEqual(ai.contributionStrategy);
    expect(result.profileOptimizations).toEqual(ai.profileOptimizations);
    expect(result.weeklyRoadmap).toEqual(ai.weeklyRoadmap);
    expect(result.successMetrics).toEqual(ai.successMetrics);
  });
});

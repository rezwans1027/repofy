import { describe, it, expect } from "vitest";
import { buildReportData } from "../../../src/services/analyze.service";
import { createAIAnalysisResponse } from "../../fixtures/ai";
import { createGitHubUserData } from "../../fixtures/github";
import type { GitHubRepo, ActivitySummary } from "../../../src/types";

describe("buildReportData", () => {
  describe("activity percentages", () => {
    it("calculates push+pr+issue+review = 100 when totalEvents > 0", () => {
      const activity: ActivitySummary = {
        totalEvents: 100,
        pushEvents: 50,
        prEvents: 25,
        issueEvents: 15,
        reviewEvents: 10,
        recentActiveRepos: [],
      };
      const github = createGitHubUserData({ activity });
      const ai = createAIAnalysisResponse();

      const report = buildReportData(ai, github);

      const { push, pr, issue, review } = report.activityBreakdown;
      expect(push + pr + issue + review).toBe(100);
      expect(push).toBe(50);
      expect(pr).toBe(25);
      expect(issue).toBe(15);
      expect(review).toBe(10);
    });

    it("all 0 when totalEvents = 0", () => {
      const activity: ActivitySummary = {
        totalEvents: 0,
        pushEvents: 0,
        prEvents: 0,
        issueEvents: 0,
        reviewEvents: 0,
        recentActiveRepos: [],
      };
      const github = createGitHubUserData({ activity });
      const ai = createAIAnalysisResponse();

      const report = buildReportData(ai, github);

      expect(report.activityBreakdown.push).toBe(0);
      expect(report.activityBreakdown.pr).toBe(0);
      expect(report.activityBreakdown.issue).toBe(0);
      expect(report.activityBreakdown.review).toBe(0);
    });
  });

  describe("starsPerRepo", () => {
    it("calculates correctly", () => {
      const github = createGitHubUserData({
        profile: {
          username: "test",
          name: "Test",
          avatarUrl: "",
          bio: null,
          company: null,
          location: null,
          blog: null,
          followers: 0,
          following: 0,
          publicRepos: 10,
          createdAt: "2020-01-01T00:00:00Z",
        },
        stats: {
          totalStars: 50,
          totalForks: 5,
          originalRepos: 8,
          accountAgeDays: 1000,
          reposTruncated: false,
        },
      });
      const ai = createAIAnalysisResponse();

      const report = buildReportData(ai, github);

      expect(report.stats.starsPerRepo).toBe(5);
    });

    it("returns 0 when publicRepos = 0", () => {
      const github = createGitHubUserData({
        profile: {
          username: "test",
          name: "Test",
          avatarUrl: "",
          bio: null,
          company: null,
          location: null,
          blog: null,
          followers: 0,
          following: 0,
          publicRepos: 0,
          createdAt: "2020-01-01T00:00:00Z",
        },
      });
      const ai = createAIAnalysisResponse();

      const report = buildReportData(ai, github);

      expect(report.stats.starsPerRepo).toBe(0);
    });
  });

  describe("topRepos enrichment", () => {
    it("enriches with GitHub repo data (case-insensitive match)", () => {
      const topRepos: GitHubRepo[] = [
        {
          name: "Cool-Project",
          fullName: "octocat/Cool-Project",
          description: "A cool project",
          url: "https://github.com/octocat/Cool-Project",
          homepage: null,
          language: "TypeScript",
          stars: 42,
          forks: 5,
          watchers: 42,
          openIssues: 2,
          isFork: false,
          isArchived: false,
          topics: ["typescript"],
          createdAt: "2020-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
          pushedAt: "2024-01-01T00:00:00Z",
        },
      ];
      const github = createGitHubUserData({ topRepositories: topRepos });
      const ai = createAIAnalysisResponse({
        topRepos: [
          {
            name: "cool-project", // lowercase vs repo "Cool-Project"
            codeQuality: "A",
            testing: "B",
            cicd: "B",
            verdict: "Excellent",
            isBestWork: true,
          },
        ],
      });

      const report = buildReportData(ai, github);

      expect(report.topRepos[0].language).toBe("TypeScript");
      expect(report.topRepos[0].stars).toBe(42);
      expect(report.topRepos[0].description).toBe("A cool project");
    });

    it("falls back for unmatched repos", () => {
      const github = createGitHubUserData({ topRepositories: [] });
      const ai = createAIAnalysisResponse({
        topRepos: [
          {
            name: "nonexistent-repo",
            codeQuality: "C",
            testing: "D",
            cicd: "D",
            verdict: "Needs work",
            isBestWork: false,
          },
        ],
      });

      const report = buildReportData(ai, github);

      expect(report.topRepos[0].language).toBeNull();
      expect(report.topRepos[0].stars).toBe(0);
      expect(report.topRepos[0].forks).toBe(0);
      expect(report.topRepos[0].description).toBeNull();
    });
  });

  describe("languageProfile", () => {
    it("slices to 6 languages", () => {
      const languages = Array.from({ length: 10 }, (_, i) => ({
        name: `Lang${i}`,
        color: "#000",
        percentage: 10,
        repoCount: 1,
      }));
      const github = createGitHubUserData({ languages });
      const ai = createAIAnalysisResponse();

      const report = buildReportData(ai, github);

      expect(report.languageProfile.languages).toHaveLength(6);
    });
  });
});

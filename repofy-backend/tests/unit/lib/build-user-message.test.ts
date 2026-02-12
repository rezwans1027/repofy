import { describe, it, expect } from "vitest";
import { buildUserMessage } from "../../../src/lib/build-user-message";
import { createGitHubUserData } from "../../fixtures/github";

describe("buildUserMessage", () => {
  it("includes profile username, name, and bio", () => {
    const data = createGitHubUserData();
    const result = buildUserMessage(data, "Analyze this.");

    expect(result).toContain("Username: octocat");
    expect(result).toContain("Name: The Octocat");
    expect(result).toContain("Bio: GitHub mascot");
  });

  it("shows N/A for null profile fields", () => {
    const data = createGitHubUserData({
      profile: {
        username: "octocat",
        name: null,
        avatarUrl: "https://example.com/avatar.png",
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
    const result = buildUserMessage(data, "Analyze this.");

    expect(result).toContain("Name: N/A");
    expect(result).toContain("Bio: N/A");
    expect(result).toContain("Company: N/A");
    expect(result).toContain("Location: N/A");
    expect(result).toContain("Blog/Website: N/A");
  });

  it("includes closing prompt", () => {
    const data = createGitHubUserData();
    const closing = "Please analyze and return JSON.";
    const result = buildUserMessage(data, closing);

    expect(result).toContain(closing);
  });

  it("includes repo summaries", () => {
    const data = createGitHubUserData();
    const result = buildUserMessage(data, "Analyze.");

    expect(result).toContain("cool-project");
    expect(result).toContain("another-repo");
  });

  it("includes language summary", () => {
    const data = createGitHubUserData();
    const result = buildUserMessage(data, "Analyze.");

    expect(result).toContain("TypeScript: 60%");
    expect(result).toContain("JavaScript: 40%");
  });

  it("includes activity data", () => {
    const data = createGitHubUserData();
    const result = buildUserMessage(data, "Analyze.");

    expect(result).toContain("Total events: 50");
    expect(result).toContain("Push events: 30");
    expect(result).toContain("PR events: 10");
  });

  it("handles empty topRepositories array", () => {
    const data = createGitHubUserData({ topRepositories: [] });
    const result = buildUserMessage(data, "Analyze.");

    expect(result).toContain("TOP REPOSITORIES");
    // Should not throw with empty repos
    expect(result).not.toContain("undefined");
  });
});

import { test, expect } from "@playwright/test";
import { TIMEOUTS } from "./helpers/timeouts";
import { deleteSeededAdvice } from "./helpers/seed";

test.describe("Search to advice flow", () => {
  test.beforeEach(async ({ page }) => {
    // Mock GitHub search API to avoid rate limiting
    await page.route("**/api/github/search**", (route) => {
      const url = new URL(route.request().url());
      const q = url.searchParams.get("q") || "";

      if (q.toLowerCase().includes("octocat")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: [
              {
                username: "octocat",
                name: "The Octocat",
                avatarUrl: "https://avatars.githubusercontent.com/u/583231",
                bio: "GitHub mascot",
                location: "San Francisco",
                company: "@github",
                repos: 8,
                followers: 10000,
              },
            ],
          }),
        });
      }

      // Non-matching queries return empty
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [] }),
      });
    });

    // Mock GitHub profile API to avoid rate limiting & speed up profile tests
    await page.route("**/api/github/octocat", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            profile: {
              name: "The Octocat",
              avatarUrl: "https://avatars.githubusercontent.com/u/583231",
              bio: "GitHub mascot",
              location: "San Francisco",
              company: "@github",
              publicRepos: 8,
              followers: 10000,
              createdAt: "2011-01-25T18:44:36Z",
            },
            stats: { totalStars: 500 },
            contributions: {
              totalContributions: 1200,
              heatmap: [],
            },
            activity: {
              totalEvents: 300,
              pushEvents: 120,
              prEvents: 80,
              issueEvents: 60,
              reviewEvents: 40,
            },
            languages: [
              { name: "Ruby", color: "#701516", percentage: 40, repoCount: 3 },
              { name: "JavaScript", color: "#f1e05a", percentage: 35, repoCount: 4 },
              { name: "Shell", color: "#89e051", percentage: 25, repoCount: 2 },
            ],
            topRepositories: [
              {
                name: "Hello-World",
                description: "My first repository on GitHub!",
                language: "Ruby",
                stars: 2000,
                forks: 1500,
                pushedAt: "2024-01-01T00:00:00Z",
                topics: ["hello-world"],
                url: "https://github.com/octocat/Hello-World",
              },
            ],
          },
        }),
      }),
    );
  });

  test("dashboard loads with search prompt", async ({ page }) => {
    await page.goto("/dashboard");

    // The dashboard has a terminal-styled search box
    // with placeholder text "username..."
    const searchInput = page.getByPlaceholder("username...");
    await expect(searchInput).toBeVisible();

    // Idle prompt shown when no query entered
    await expect(
      page.getByText("Type a GitHub username to search"),
    ).toBeVisible();
  });

  test("search for user shows results", async ({ page }) => {
    await page.goto("/dashboard");

    const searchInput = page.getByPlaceholder("username...");
    await searchInput.fill("octocat");

    // "Searching GitHub..." indicator appears while fetching
    await expect(page.getByText("Searching GitHub...")).toBeVisible();

    // Wait for search results to appear (card with @username)
    await expect(page.getByText("@octocat").first()).toBeVisible({
      timeout: TIMEOUTS.API,
    });
  });

  test("search with no results shows warning", async ({ page }) => {
    await page.goto("/dashboard");

    const searchInput = page.getByPlaceholder("username...");
    // Use a username that's extremely unlikely to exist
    await searchInput.fill("zzz_nonexistent_user_xyz_12345");

    // Wait for "No users found" message
    await expect(
      page
        .getByText(/no users found matching/i)
        .first(),
    ).toBeVisible({ timeout: TIMEOUTS.API });
  });

  test("clicking a search result navigates to profile", async ({ page }) => {
    await page.goto("/dashboard");

    const searchInput = page.getByPlaceholder("username...");
    await searchInput.fill("octocat");

    // Wait for results
    const resultCard = page.getByText("@octocat").first();
    await resultCard.waitFor({ timeout: TIMEOUTS.API });

    // Click the result card — the entire card is clickable
    await resultCard.click();

    // Should navigate to profile page
    await expect(page).toHaveURL(/\/profile\/octocat/i);
  });

  test("profile page loads with user header and sections", async ({
    page,
  }) => {
    await page.goto("/profile/octocat");

    // Profile header shows the username (use .first() — CTA bar also has @octocat)
    await expect(page.getByText("@octocat").first()).toBeVisible({
      timeout: TIMEOUTS.API,
    });

    // "back to search" link
    await expect(page.getByText("back to search")).toBeVisible();

    // "View on GitHub" link
    await expect(page.getByText("View on GitHub")).toBeVisible();

    // Profile data loads — sections render
    await expect(page.getByText("Repositories").first()).toBeVisible({
      timeout: TIMEOUTS.PROFILE,
    });
  });

  test("profile page shows CTA bar with Get Advice enabled and Start Analysis disabled", async ({
    page,
  }) => {
    await page.goto("/profile/octocat");

    // Wait for profile data to load
    await expect(page.getByText("@octocat").first()).toBeVisible({
      timeout: TIMEOUTS.API,
    });

    // "Get Advice" button is visible and enabled
    const adviceBtn = page.getByRole("button", { name: /get advice/i });
    await expect(adviceBtn).toBeVisible({ timeout: TIMEOUTS.QUICK });
    await expect(adviceBtn).toBeEnabled();

    // "Start Analysis" button is visible but disabled (Coming Soon)
    const analysisBtn = page.getByRole("button", { name: /start analysis/i });
    await expect(analysisBtn).toBeVisible();
    await expect(analysisBtn).toBeDisabled();
  });

  test("clicking Get Advice shows credit confirmation dialog", async ({
    page,
  }) => {
    // Mock credits balance — user has credits
    await page.route("**/api/credits/balance", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { growth_balance: 5, eval_balance: 0 } }),
      }),
    );

    // Mock existing advice check — no advice exists yet
    await page.route("**/rest/v1/advice*", (route) => {
      const url = route.request().url();
      if (url.includes("select=id")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
      }
      return route.continue();
    });

    await page.goto("/profile/octocat");

    // Wait for profile to load and CTA bar to appear
    const adviceBtn = page.getByRole("button", { name: /get advice/i });
    await adviceBtn.waitFor({ timeout: TIMEOUTS.ELEMENT });
    await adviceBtn.click();

    // Credit confirmation dialog appears
    await expect(
      page.getByRole("heading", { name: "Use 1 growth credit" }),
    ).toBeVisible({ timeout: TIMEOUTS.DIALOG });
    await expect(
      page.getByRole("button", { name: /continue/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /cancel/i }),
    ).toBeVisible();

    // Click Cancel — dialog closes, still on profile page
    await page.getByRole("button", { name: /cancel/i }).click();
    await expect(page).toHaveURL(/\/profile\/octocat/i);
  });

  test("clicking Get Advice with no credits shows no credits dialog", async ({
    page,
  }) => {
    // Mock credits balance — user has no credits
    await page.route("**/api/credits/balance", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { growth_balance: 0, eval_balance: 0 } }),
      }),
    );

    // Mock existing advice check — no advice exists
    await page.route("**/rest/v1/advice*", (route) => {
      const url = route.request().url();
      if (url.includes("select=id")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
      }
      return route.continue();
    });

    await page.goto("/profile/octocat");

    const adviceBtn = page.getByRole("button", { name: /get advice/i });
    await adviceBtn.waitFor({ timeout: TIMEOUTS.ELEMENT });

    // Wait for the credit balance data to be rendered in the navbar.
    // The credit badge spans have opacity 0 → 1 once data loads.
    await page.waitForFunction(() => {
      const link = document.querySelector('a[href="/pricing"]');
      if (!link) return false;
      const spans = link.querySelectorAll("span > span:last-child");
      return Array.from(spans).some(
        (s) => (s as HTMLElement).style.opacity === "1",
      );
    }, { timeout: TIMEOUTS.ELEMENT });

    await adviceBtn.click();

    // No credits dialog appears — check for heading specifically
    await expect(
      page.getByRole("heading", { name: "No growth credits" }),
    ).toBeVisible({ timeout: TIMEOUTS.DIALOG });
    await expect(
      page.getByRole("link", { name: /buy credits/i }),
    ).toBeVisible();
  });

  test("full flow: search, profile, get advice, view advice", async ({
    page,
  }) => {
    // Mock credits balance
    await page.route("**/api/credits/balance", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { growth_balance: 5, eval_balance: 0 } }),
      }),
    );

    // Mock Supabase advice queries
    await page.route("**/rest/v1/advice*", (route) => {
      const url = route.request().url();
      const accept = route.request().headers()["accept"] || "";

      // Detail query (useAdvice) — .single() sends object accept header
      if (accept.includes("vnd.pgrst.object") || url.includes("id=eq.mock-advice-id")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: "mock-advice-id",
            analyzed_username: "octocat",
            user_id: "test-user-id",
            advice_data: {
              schemaVersion: "v2",
              generationWarnings: [],
              summary: "Mock advice summary for octocat.",
              trajectory: {
                currentEstimate: "Mid-level",
                targetEstimate: "Senior",
                confidence: "Medium",
                rationale: "Mock rationale.",
                calibration: {
                  complexity: "Medium",
                  breadth: "Moderate",
                  collaboration: "Active",
                  engineeringPractices: "Good",
                  consistency: "Steady",
                },
              },
              buildRoadmap: [],
              weeklyRoadmap: [],
              strengthsAndGaps: { strengths: [], gaps: [] },
              careerPositioning: { positioning: "", roles: [], differentiators: [] },
              repoImprovements: [],
              skillRoadmap: [],
              contributionStrategy: [],
              profileOptimizations: [],
              successMetrics: [],
            },
          }),
        });
      }

      // Existing advice check (useExistingAdvice) — returns empty array
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    // Mock advice generation endpoint
    await page.route("**/api/advice/**", (route) => {
      if (route.request().method() === "POST") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: { adviceId: "mock-advice-id" },
          }),
        });
      }
      return route.continue();
    });

    // Step 1: Search on dashboard
    await page.goto("/dashboard");
    const searchInput = page.getByPlaceholder("username...");
    await searchInput.fill("octocat");

    // Step 2: Click result to go to profile
    const resultCard = page.getByText("@octocat").first();
    await resultCard.waitFor({ timeout: TIMEOUTS.API });
    await resultCard.click();
    await expect(page).toHaveURL(/\/profile\/octocat/i);

    // Step 3: Click Get Advice — credit confirmation dialog appears
    const adviceBtn = page.getByRole("button", { name: /get advice/i });
    await adviceBtn.waitFor({ timeout: TIMEOUTS.ELEMENT });
    await adviceBtn.click();

    await expect(
      page.getByRole("heading", { name: "Use 1 growth credit" }),
    ).toBeVisible({ timeout: TIMEOUTS.DIALOG });

    // Step 4: Click Continue — navigates to advisor generate page
    await page.getByRole("button", { name: /continue/i }).click();
    await expect(page).toHaveURL(/\/advisor\/generate\/octocat/i, {
      timeout: TIMEOUTS.ELEMENT,
    });

    // Step 5: Wait for analysis phases
    await expect(
      page.getByText("Scanning profile...").first(),
    ).toBeVisible({ timeout: TIMEOUTS.QUICK });

    // Step 6: Wait for redirect to advice view page
    await page.waitForURL(/\/advisor\/mock-advice-id/, {
      timeout: TIMEOUTS.ANALYSIS,
    });

    // Step 7: Verify advice page loads
    await expect(page.getByText("back to").first()).toBeVisible({
      timeout: TIMEOUTS.ELEMENT,
    });
  });

  test.afterEach(async ({ page }) => {
    // Cleanup is best-effort — some tests don't create real advice
    // and may not have a Supabase session in localStorage
    try {
      await deleteSeededAdvice(page, ["octocat"]);
    } catch {
      // Ignore cleanup errors (e.g. no session when mocks intercepted everything)
    }
  });
});

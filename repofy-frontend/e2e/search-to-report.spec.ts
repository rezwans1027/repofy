import { test, expect } from "@playwright/test";
import { TIMEOUTS } from "./helpers/timeouts";

test.describe("Search to report flow", () => {
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
    // The card is a motion.div with onClick that pushes to /profile/{username}
    await resultCard.click();

    // Should navigate to profile page
    await expect(page).toHaveURL(/\/profile\/octocat/i);
  });

  test("profile page loads with user header and sections", async ({
    page,
  }) => {
    await page.goto("/profile/octocat");

    // Profile header shows the username
    await expect(page.getByText("@octocat")).toBeVisible({ timeout: TIMEOUTS.API });

    // "back to search" link
    await expect(page.getByText("back to search")).toBeVisible();

    // "View on GitHub" link
    await expect(page.getByText("View on GitHub")).toBeVisible();

    // Wait for profile data to load — the loading skeleton has
    // "Fetching profile data from GitHub..." text
    // Once loaded, we should see stats sections
    await expect(page.getByText(/repos/i).first()).toBeVisible({
      timeout: TIMEOUTS.PROFILE,
    });
  });

  test("profile page shows sticky CTA bar with Start Analysis button", async ({
    page,
  }) => {
    await page.goto("/profile/octocat");

    // Wait for profile data to load
    await expect(page.getByText("@octocat")).toBeVisible({ timeout: TIMEOUTS.API });

    // The StickyCTABar appears after a short delay (50ms default)
    // It contains "Start Analysis" and "Get Advice" buttons
    await expect(
      page.getByRole("button", { name: /start analysis/i }),
    ).toBeVisible({ timeout: TIMEOUTS.QUICK });

    await expect(
      page.getByRole("button", { name: /get advice/i }),
    ).toBeVisible();
  });

  test("clicking Start Analysis navigates to generate page", async ({
    page,
  }) => {
    await page.goto("/profile/octocat");

    // Wait for profile to load
    await expect(page.getByText("@octocat")).toBeVisible({ timeout: TIMEOUTS.API });

    // Click Start Analysis
    const analysisBtn = page.getByRole("button", { name: /start analysis/i });
    await analysisBtn.waitFor({ timeout: TIMEOUTS.QUICK });
    await analysisBtn.click();

    // Should navigate to /generate/octocat
    // (if report already exists, a confirmation dialog appears first)
    // Wait for either the generate page or the "replace report" dialog
    const replaceBtn = page.getByRole("button", {
      name: /replace report/i,
    });
    const generateUrl = page.waitForURL(/\/generate\/octocat/i, { timeout: TIMEOUTS.QUICK });
    const dialogVisible = replaceBtn
      .waitFor({ state: "visible", timeout: TIMEOUTS.QUICK })
      .then(() => true)
      .catch(() => false);

    const showedDialog = await Promise.race([
      generateUrl.then(() => false),
      dialogVisible,
    ]);

    if (showedDialog) {
      await replaceBtn.click();
      await expect(page).toHaveURL(/\/generate\/octocat/i);
    }

    // The AnalysisLoading component shows phases
    await expect(
      page.getByText("Scanning profile...").first(),
    ).toBeVisible({ timeout: TIMEOUTS.QUICK });
  });

  test("full flow: search, profile, generate, view report", async ({
    page,
  }) => {
    // Step 1: Search
    await page.goto("/dashboard");
    const searchInput = page.getByPlaceholder("username...");
    await searchInput.fill("octocat");

    // Step 2: Click result to go to profile
    const resultCard = page.getByText("@octocat").first();
    await resultCard.waitFor({ timeout: TIMEOUTS.API });
    await resultCard.click();
    await expect(page).toHaveURL(/\/profile\/octocat/i);

    // Step 3: Click Start Analysis
    const analysisBtn = page.getByRole("button", { name: /start analysis/i });
    await analysisBtn.waitFor({ timeout: TIMEOUTS.ELEMENT });
    await analysisBtn.click();

    // Handle "report already exists" dialog if it appears
    const replaceBtn = page.getByRole("button", { name: /replace report/i });
    const isReplaceVisible = await replaceBtn
      .waitFor({ state: "visible", timeout: TIMEOUTS.DIALOG })
      .then(() => true)
      .catch(() => false);
    if (isReplaceVisible) {
      await replaceBtn.click();
    }

    // Step 4: Wait for analysis to complete and redirect to report
    // With MOCK_AI=true, this should be fast
    await page.waitForURL(/\/report\//, { timeout: TIMEOUTS.ANALYSIS });

    // Step 5: Verify report page loads
    // The report page renders AnalysisReport which shows TopBanner, Summary, etc.
    await expect(page.getByText("back to").first()).toBeVisible({
      timeout: TIMEOUTS.ELEMENT,
    });
  });
});

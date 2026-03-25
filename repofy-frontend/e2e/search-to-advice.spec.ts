import { test, expect } from "@playwright/test";
import { TIMEOUTS } from "./helpers/timeouts";
import { deleteSeededAdvice } from "./helpers/seed";

test.describe("Search to advice flow", () => {
  // No browser-level mocks — the backend uses a real GitHub token to call
  // the GitHub API. Tests use "octocat" (GitHub's mascot account) which is
  // stable and always available.

  test("dashboard loads with search prompt", async ({ page }) => {
    await page.goto("/dashboard");

    const searchInput = page.getByPlaceholder("username...");
    await expect(searchInput).toBeVisible();

    await expect(
      page.getByText("Type a GitHub username to search"),
    ).toBeVisible();
  });

  test("search for user shows results", async ({ page }) => {
    await page.goto("/dashboard");

    const searchInput = page.getByPlaceholder("username...");
    await searchInput.fill("octocat");

    // octocat is GitHub's mascot — always returns results
    await expect(page.getByText("@octocat").first()).toBeVisible({
      timeout: TIMEOUTS.API,
    });
  });

  test("search with no results shows warning", async ({ page }) => {
    await page.goto("/dashboard");

    const searchInput = page.getByPlaceholder("username...");
    await searchInput.fill("zzz_nonexistent_user_xyz_12345");

    await expect(
      page.getByText(/no users found matching/i).first(),
    ).toBeVisible({ timeout: TIMEOUTS.API });
  });

  test("clicking a search result navigates to profile", async ({ page }) => {
    await page.goto("/dashboard");

    const searchInput = page.getByPlaceholder("username...");
    await searchInput.fill("octocat");

    const resultCard = page.getByText("@octocat").first();
    await resultCard.waitFor({ timeout: TIMEOUTS.API });
    await resultCard.click();

    await expect(page).toHaveURL(/\/profile\/octocat/i);
  });

  test("profile page loads with user header and sections", async ({
    page,
  }) => {
    await page.goto("/profile/octocat");

    await expect(page.getByText("@octocat").first()).toBeVisible({
      timeout: TIMEOUTS.API,
    });

    await expect(page.getByText("back to search")).toBeVisible();
    await expect(page.getByText("View on GitHub")).toBeVisible();

    await expect(page.getByText("Repositories").first()).toBeVisible({
      timeout: TIMEOUTS.PROFILE,
    });
  });

  test.afterEach(async ({ page }) => {
    try {
      await deleteSeededAdvice(page, ["octocat"]);
    } catch {
      // Ignore cleanup errors
    }
  });
});

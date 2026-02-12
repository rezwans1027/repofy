import { test, expect } from "@playwright/test";
import { TIMEOUTS } from "./helpers/timeouts";
import { seedReportViaApi } from "./helpers/seed";

test.describe("Reports page", () => {
  // Seed a report before each test via API (faster than full UI flow)
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
    await seedReportViaApi(page, "octocat");
  });

  test("reports page renders table with report data", async ({ page }) => {
    await page.goto("/reports");

    // Table headers must be visible
    await expect(page.getByText("Username").first()).toBeVisible({
      timeout: TIMEOUTS.ELEMENT,
    });

    // Seeded report must appear in the table
    await expect(page.getByText("@octocat").first()).toBeVisible();
  });

  test("reports page search filter works", async ({ page }) => {
    await page.goto("/reports");
    await expect(page.getByText("Username").first()).toBeVisible({
      timeout: TIMEOUTS.ELEMENT,
    });

    // Search input must be present
    const searchInput = page.getByPlaceholder("Search");
    await expect(searchInput).toBeVisible();

    // Filter for the seeded report — must match
    await searchInput.fill("octocat");
    await expect(page.getByText("@octocat").first()).toBeVisible();

    // Non-matching query — must show "No reports match"
    await searchInput.fill("zzz_no_match_xyz");
    await expect(
      page.getByText("No reports match your filters"),
    ).toBeVisible();

    // Clear filters link must be available and functional
    await expect(page.getByText("Clear all filters")).toBeVisible();
    await page.getByText("Clear all filters").click();

    // After clearing, the seeded report must reappear
    await expect(page.getByText("@octocat").first()).toBeVisible();
  });

  test("reports page filter dropdown opens with recommendation badges", async ({
    page,
  }) => {
    await page.goto("/reports");
    await expect(page.getByText("Username").first()).toBeVisible({
      timeout: TIMEOUTS.ELEMENT,
    });

    const filterBtn = page.getByRole("button", { name: /filter/i });
    await expect(filterBtn).toBeVisible();
    await filterBtn.click();

    // Recommendation badges must all be present in the popover
    await expect(page.getByText("Strong Hire")).toBeVisible();
    await expect(page.getByText("Hire").first()).toBeVisible();
    await expect(page.getByText("Weak Hire")).toBeVisible();
    await expect(page.getByText("No Hire")).toBeVisible();
    await expect(page.getByText("Score range")).toBeVisible();
  });

  test("reports page sort dropdown works", async ({ page }) => {
    await page.goto("/reports");
    await expect(page.getByText("Username").first()).toBeVisible({
      timeout: TIMEOUTS.ELEMENT,
    });

    const sortBtn = page.getByRole("button", { name: /newest first/i });
    await expect(sortBtn).toBeVisible();
    await sortBtn.click();

    // Sort options must be present
    await expect(page.getByText("Oldest first")).toBeVisible();
    await expect(page.getByText("Highest score")).toBeVisible();
    await expect(page.getByText("Lowest score")).toBeVisible();

    // Select a different sort
    await page.getByText("Highest score").click();
  });

  test("reports page select mode and delete flow", async ({ page }) => {
    await page.goto("/reports");
    await expect(page.getByText("Username").first()).toBeVisible({
      timeout: TIMEOUTS.ELEMENT,
    });

    // Count rows before deletion
    const rowsBefore = await page.locator("tbody tr").count();

    // Enter select mode
    const selectBtn = page.getByRole("button", { name: /select/i });
    await expect(selectBtn).toBeVisible();
    await selectBtn.click();

    // Cancel button must appear
    await expect(
      page.getByRole("button", { name: /cancel/i }),
    ).toBeVisible();

    // Click the first report row to select it
    const firstRow = page.locator("tbody tr").first();
    await expect(firstRow).toBeVisible();
    await firstRow.click();

    // Selection bar must show count and delete button
    await expect(page.getByText(/1 selected/)).toBeVisible();
    const deleteBtn = page.getByRole("button", { name: /delete/i });
    await expect(deleteBtn).toBeVisible();

    // Click delete and verify the row is removed
    await deleteBtn.click();

    // Selection bar must disappear (select mode exits on successful delete)
    await expect(page.getByText(/1 selected/)).not.toBeVisible({
      timeout: TIMEOUTS.ELEMENT,
    });

    // Row count must decrease by 1 (or show empty state if it was the only report)
    if (rowsBefore === 1) {
      await expect(page.locator("tbody tr")).toHaveCount(0);
    } else {
      await expect(page.locator("tbody tr")).toHaveCount(rowsBefore - 1);
    }
  });

  test("clicking a report username navigates to report detail", async ({
    page,
  }) => {
    await page.goto("/reports");
    await expect(page.getByText("Username").first()).toBeVisible({
      timeout: TIMEOUTS.ELEMENT,
    });

    // Click the first report link
    const reportLink = page.locator("tbody tr td a").first();
    await expect(reportLink).toBeVisible();
    await reportLink.click();
    await expect(page).toHaveURL(/\/report\//);

    // Report detail page must show back link
    await expect(page.getByText("back to reports")).toBeVisible({
      timeout: TIMEOUTS.ELEMENT,
    });
  });
});

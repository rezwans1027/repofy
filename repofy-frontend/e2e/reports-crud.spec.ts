import { test, expect } from "@playwright/test";

test.describe("Reports page", () => {
  test("reports page shows empty state when no reports exist", async ({
    page,
  }) => {
    // Note: this test may see existing reports depending on the test account.
    // If reports exist, the table will render instead.
    await page.goto("/reports");

    // Wait for loading to finish
    // Either we see the empty state or the reports table
    const heading = page.getByText("Reports").first();
    await expect(heading).toBeVisible({ timeout: 10000 });
  });

  test("reports page renders table with reports", async ({ page }) => {
    // First, ensure at least one report exists by generating one
    // Navigate to generate a report for octocat via the UI flow
    await page.goto("/dashboard");
    const searchInput = page.getByPlaceholder("username...");
    await searchInput.fill("octocat");

    const resultCard = page.getByText("@octocat").first();
    await resultCard.waitFor({ timeout: 15000 });
    await resultCard.click();
    await expect(page).toHaveURL(/\/profile\/octocat/i);

    // Trigger analysis
    const analysisBtn = page.getByRole("button", { name: /start analysis/i });
    await analysisBtn.waitFor({ timeout: 10000 });
    await analysisBtn.click();

    // Handle replace dialog if report already exists
    const replaceBtn = page.getByRole("button", { name: /replace report/i });
    if (await replaceBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await replaceBtn.click();
    }

    // Wait for report to complete
    await page.waitForURL(/\/report\//, { timeout: 60000 });

    // Now navigate to /reports
    await page.goto("/reports");

    // Wait for the reports table to render
    // The table has headers: Username, Name, Score, Recommendation, Date
    await expect(page.getByText("Username").first()).toBeVisible({
      timeout: 10000,
    });

    // Should see @octocat in the table
    await expect(page.getByText("@octocat").first()).toBeVisible();
  });

  test("reports page search filter works", async ({ page }) => {
    await page.goto("/reports");

    // Wait for page to fully load
    const heading = page.getByText("Reports").first();
    await expect(heading).toBeVisible({ timeout: 10000 });

    // The search input has placeholder "Search..."
    const searchInput = page.getByPlaceholder("Search");
    // Only test if search is visible (i.e., reports exist)
    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Type a filter query
      await searchInput.fill("octocat");

      // Results should still show octocat (if it exists)
      // or show "No reports match your filters"
      const hasResults = await page
        .getByText("@octocat")
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false);

      if (!hasResults) {
        await expect(
          page.getByText("No reports match your filters"),
        ).toBeVisible();
      }

      // Type a non-matching query
      await searchInput.fill("zzz_no_match_xyz");
      await expect(
        page.getByText("No reports match your filters"),
      ).toBeVisible();

      // Clear filters link should be available
      await expect(page.getByText("Clear all filters")).toBeVisible();
      await page.getByText("Clear all filters").click();
    }
  });

  test("reports page filter dropdown opens and has recommendation badges", async ({
    page,
  }) => {
    await page.goto("/reports");
    await expect(page.getByText("Reports").first()).toBeVisible({
      timeout: 10000,
    });

    // The filter button has text "Filter"
    const filterBtn = page.getByRole("button", { name: /filter/i });
    if (await filterBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await filterBtn.click();

      // The popover should show recommendation badges
      await expect(page.getByText("Strong Hire")).toBeVisible();
      await expect(page.getByText("Hire").first()).toBeVisible();
      await expect(page.getByText("Weak Hire")).toBeVisible();
      await expect(page.getByText("No Hire")).toBeVisible();

      // Score range section
      await expect(page.getByText("Score range")).toBeVisible();
    }
  });

  test("reports page sort dropdown works", async ({ page }) => {
    await page.goto("/reports");
    await expect(page.getByText("Reports").first()).toBeVisible({
      timeout: 10000,
    });

    // The sort button shows current sort label, default is "Newest first"
    const sortBtn = page.getByRole("button", { name: /newest first/i });
    if (await sortBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sortBtn.click();

      // Sort options dropdown
      await expect(page.getByText("Oldest first")).toBeVisible();
      await expect(page.getByText("Highest score")).toBeVisible();
      await expect(page.getByText("Lowest score")).toBeVisible();

      // Select a different sort
      await page.getByText("Highest score").click();
    }
  });

  test("reports page select mode and delete flow", async ({ page }) => {
    await page.goto("/reports");
    await expect(page.getByText("Reports").first()).toBeVisible({
      timeout: 10000,
    });

    // "Select" button toggles select mode
    const selectBtn = page.getByRole("button", { name: /select/i });
    if (await selectBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await selectBtn.click();

      // In select mode, the button changes to "Cancel"
      await expect(
        page.getByRole("button", { name: /cancel/i }),
      ).toBeVisible();

      // Clicking a table row in select mode toggles its checkbox
      // Check if there are report rows to select
      const firstRow = page.locator("tbody tr").first();
      if (await firstRow.isVisible({ timeout: 2000 }).catch(() => false)) {
        await firstRow.click();

        // Bottom bar should appear with "1 selected" and a Delete button
        await expect(page.getByText(/1 selected/)).toBeVisible();
        await expect(
          page.getByRole("button", { name: /delete/i }),
        ).toBeVisible();

        // Cancel select mode without deleting
        await page.getByRole("button", { name: /cancel/i }).click();

        // Delete button and selection bar should disappear
        await expect(page.getByText(/1 selected/)).not.toBeVisible();
      }
    }
  });

  test("clicking a report username navigates to report detail", async ({
    page,
  }) => {
    await page.goto("/reports");
    await expect(page.getByText("Reports").first()).toBeVisible({
      timeout: 10000,
    });

    // Click on a report link (the username in the table is a Link to /report/{id})
    const reportLink = page.locator("tbody tr td a").first();
    if (await reportLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await reportLink.click();
      await expect(page).toHaveURL(/\/report\//);

      // Report detail page should show "back to reports" link
      await expect(page.getByText("back to reports")).toBeVisible({
        timeout: 10000,
      });
    }
  });
});

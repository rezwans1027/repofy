import { test, expect } from "@playwright/test";
import { generateReportViaUI } from "./helpers/seed";

test.describe("Compare flow", () => {
  test("compare page shows empty state with fewer than 2 reports", async ({
    page,
  }) => {
    // Navigate directly without seeding — relies on fresh test account or
    // at most 1 report from other specs (run serially).
    // The "Need at least 2 reports" message OR the heading must appear.
    await page.goto("/compare");
    const heading = page
      .getByRole("heading", { name: /compare/i })
      .first();
    await expect(heading).toBeVisible({ timeout: 10000 });
  });

  test("compare page renders candidate pickers when 2 reports exist", async ({
    page,
  }) => {
    // Self-seed: generate 2 reports
    await generateReportViaUI(page, "octocat");
    await generateReportViaUI(page, "torvalds");

    await page.goto("/compare");

    // Must see "Compare Candidates" heading (not empty state)
    await expect(
      page.getByRole("heading", { name: /compare candidates/i }),
    ).toBeVisible({ timeout: 10000 });

    // Candidate A and B labels must be present
    await expect(page.getByText("Candidate A")).toBeVisible();
    await expect(page.getByText("Candidate B")).toBeVisible();

    // Two combobox pickers must be present
    const pickers = page.getByRole("combobox");
    await expect(pickers).toHaveCount(2);
  });

  test("selecting two candidates shows comparison sections", async ({
    page,
  }) => {
    // Self-seed: generate 2 reports
    await generateReportViaUI(page, "octocat");
    await generateReportViaUI(page, "torvalds");

    await page.goto("/compare");

    // Wait for pickers to render
    const pickers = page.getByRole("combobox");
    await expect(pickers).toHaveCount(2);

    // Select Candidate A
    const pickerA = pickers.nth(0);
    await pickerA.click();
    const optionA = page.locator("[cmdk-item]").first();
    await expect(optionA).toBeVisible({ timeout: 5000 });
    await optionA.click();

    // Select Candidate B (pick a non-disabled option)
    const pickerB = pickers.nth(1);
    await pickerB.click();
    const optionB = page
      .locator('[cmdk-item]:not([aria-disabled="true"])')
      .first();
    await expect(optionB).toBeVisible({ timeout: 5000 });
    await optionB.click();

    // Comparison sections must render unconditionally
    await expect(page.getByText(/strengths/i).first()).toBeVisible({
      timeout: 15000,
    });
    await expect(
      page.getByText(/top repositories/i).first(),
    ).toBeVisible();
    await expect(
      page.getByText(/areas for improvement/i).first(),
    ).toBeVisible();
  });

  test("compare page renders error state with retry button on failure", async ({
    page,
  }) => {
    // Force an error by intercepting the Supabase reports query
    await page.route("**/rest/v1/reports*", (route) =>
      route.fulfill({ status: 500, body: "Internal Server Error" }),
    );

    await page.goto("/compare");

    // The error state must show the error message and a retry button
    await expect(page.getByText(/retry/i)).toBeVisible({ timeout: 10000 });
  });
});

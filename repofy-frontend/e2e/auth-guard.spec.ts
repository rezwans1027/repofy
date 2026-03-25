import { test, expect } from "@playwright/test";

test.describe("Auth guard", () => {
  test("redirects /dashboard to /login when unauthenticated", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("redirects /reports to /login when unauthenticated", async ({
    page,
  }) => {
    // /reports starts with /report which is a protected route
    await page.goto("/reports");
    await expect(page).toHaveURL(/\/login/);
  });

  test("redirects /compare to /login when unauthenticated", async ({
    page,
  }) => {
    await page.goto("/compare");
    await expect(page).toHaveURL(/\/login/);
  });

  test("redirects /profile/:username to /login when unauthenticated", async ({
    page,
  }) => {
    await page.goto("/profile/octocat");
    await expect(page).toHaveURL(/\/login/);
  });

  test("redirects /generate/:username to /login when unauthenticated", async ({
    page,
  }) => {
    await page.goto("/generate/octocat");
    await expect(page).toHaveURL(/\/login/);
  });

  test("login page shows Continue with GitHub button", async ({ page }) => {
    await page.goto("/login");
    await expect(
      page.getByRole("button", { name: /continue with github/i }),
    ).toBeVisible();
  });
});

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

  test("login page renders sign in form", async ({ page }) => {
    await page.goto("/login");
    // The login page has a terminal-styled form with email/password fields
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /sign in/i }),
    ).toBeVisible();
  });

  test("login page shows validation errors for empty submit", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /sign in/i }).click();
    // Validation errors display with "error:" prefix
    await expect(page.getByText("Email is required")).toBeVisible();
    await expect(page.getByText("Password is required")).toBeVisible();
  });
});

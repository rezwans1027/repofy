import { test as setup, expect } from "@playwright/test";
import { TIMEOUTS } from "./helpers/timeouts";

const authFile = "e2e/.auth/user.json";

setup("authenticate", async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;

  if (!email || !password) {
    throw new Error("E2E_TEST_EMAIL and E2E_TEST_PASSWORD must be set");
  }

  await page.goto("/login");

  // The login form uses <label> elements with text "email" and "password"
  // and a submit button with text "Sign In"
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();

  // Wait for redirect to dashboard after successful login
  await page.waitForURL(/\/dashboard/, { timeout: TIMEOUTS.API });

  // Verify we actually landed on the dashboard
  await expect(page).toHaveURL(/\/dashboard/);

  // Save auth state (cookies + localStorage with Supabase session)
  await page.context().storageState({ path: authFile });
});

import { test as setup, expect } from "@playwright/test";

const authFile = "e2e/.auth/user.json";

setup("authenticate", async ({ page }) => {
  // GitHub OAuth cannot be automated in Playwright.
  // This setup loads a pre-saved storageState from a manual login session.
  // To generate it:
  //   1. Run `npx playwright codegen http://localhost:3000/login`
  //   2. Complete the GitHub OAuth flow manually
  //   3. Copy the resulting storageState to e2e/.auth/user.json

  // Check if saved auth state exists
  const fs = await import("fs");
  if (!fs.existsSync(authFile)) {
    throw new Error(
      `Auth state file not found at ${authFile}. ` +
      "Please log in manually and save the storageState. " +
      "See e2e/auth.setup.ts for instructions.",
    );
  }

  // Load the saved auth state and verify it works
  await page.context().addCookies(
    JSON.parse(fs.readFileSync(authFile, "utf-8")).cookies ?? [],
  );

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard/);
});

import type { Page } from "@playwright/test";

const BACKEND_URL = "http://localhost:3003";

/**
 * Retrieve the Supabase access token from the page's localStorage.
 * The Supabase JS client stores the session under a key that includes
 * the project reference (e.g. "sb-<ref>-auth-token").
 */
export async function getAccessToken(page: Page): Promise<string> {
  const token = await page.evaluate(() => {
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.includes("sb-") && key.includes("-auth-token")) {
        try {
          const raw = localStorage.getItem(key);
          if (!raw) continue;
          const parsed = JSON.parse(raw);
          // Supabase v2 stores { access_token, refresh_token, ... }
          if (parsed?.access_token) return parsed.access_token as string;
          // Some versions nest under currentSession
          if (parsed?.currentSession?.access_token)
            return parsed.currentSession.access_token as string;
        } catch {
          // skip malformed entries
        }
      }
    }
    return null;
  });

  if (!token) {
    throw new Error("No Supabase auth token found in localStorage");
  }
  return token;
}

/**
 * Generate a report for the given GitHub username via the backend API.
 * Uses the page's stored auth context to authenticate.
 *
 * When the backend is started with MOCK_AI=true, this returns quickly
 * with deterministic fixture data.
 *
 * Returns the raw response body (which includes analyzedName + report).
 */
export async function generateReportViaApi(
  page: Page,
  username: string,
): Promise<{ analyzedName: string | null; report: Record<string, unknown> }> {
  const token = await getAccessToken(page);

  const response = await page.request.post(
    `${BACKEND_URL}/api/analyze/${encodeURIComponent(username)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!response.ok()) {
    const body = await response.text();
    throw new Error(`generate report failed: ${response.status()} ${body}`);
  }

  const json = (await response.json()) as {
    success?: boolean;
    data?: { analyzedName: string | null; report: Record<string, unknown> };
    analyzedName?: string | null;
    report?: Record<string, unknown>;
  };
  // Backend wraps in { success, data }
  return (json.data ?? json) as {
    analyzedName: string | null;
    report: Record<string, unknown>;
  };
}

/**
 * Generate a report through the UI flow: search for user, click profile,
 * click Start Analysis, wait for completion.
 *
 * This is more realistic than the API-only approach and ensures the report
 * is saved to Supabase via the frontend's normal flow.
 */
export async function generateReportViaUI(
  page: Page,
  username: string,
): Promise<void> {
  await page.goto("/dashboard");

  const searchInput = page.getByPlaceholder("username...");
  await searchInput.fill(username);

  // Wait for search results
  const resultCard = page.getByText(`@${username}`).first();
  await resultCard.waitFor({ timeout: 15000 });
  await resultCard.click();

  // Wait for profile page
  await page.waitForURL(new RegExp(`/profile/${username}`, "i"));

  // Click Start Analysis
  const analysisBtn = page.getByRole("button", { name: /start analysis/i });
  await analysisBtn.waitFor({ timeout: 10000 });
  await analysisBtn.click();

  // Handle "report already exists" dialog
  const replaceBtn = page.getByRole("button", { name: /replace report/i });
  const isReplaceVisible = await replaceBtn
    .isVisible({ timeout: 2000 })
    .catch(() => false);
  if (isReplaceVisible) {
    await replaceBtn.click();
  }

  // Wait for report generation to complete and redirect
  await page.waitForURL(/\/report\//, { timeout: 60000 });
}

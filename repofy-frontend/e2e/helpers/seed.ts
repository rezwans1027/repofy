import { readFileSync } from "fs";
import { resolve } from "path";
import type { Page } from "@playwright/test";
import { TIMEOUTS } from "./timeouts";

const BACKEND_URL = "http://localhost:3003";

/** Read Supabase config from .env.local (runs in Node / Playwright context). */
function getSupabaseConfig(): { url: string; anonKey: string } {
  const envPath = resolve(__dirname, "../../.env.local");
  const content = readFileSync(envPath, "utf-8");
  const vars: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.+)$/);
    if (match) vars[match[1]] = match[2];
  }
  const url = vars["NEXT_PUBLIC_SUPABASE_URL"];
  const anonKey = vars["NEXT_PUBLIC_SUPABASE_ANON_KEY"];
  if (!url || !anonKey) {
    throw new Error("Missing Supabase env vars in .env.local");
  }
  return { url, anonKey };
}

/**
 * Retrieve the Supabase session info from the page's localStorage.
 * Returns the access token and user ID from the stored session.
 */
async function getSupabaseSession(
  page: Page,
): Promise<{ accessToken: string; userId: string }> {
  const session = await page.evaluate(() => {
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.includes("sb-") && key.includes("-auth-token")) {
        try {
          const raw = localStorage.getItem(key);
          if (!raw) continue;
          const parsed = JSON.parse(raw);
          const token =
            parsed?.access_token ?? parsed?.currentSession?.access_token;
          const userId =
            parsed?.user?.id ?? parsed?.currentSession?.user?.id;
          if (token && userId) return { accessToken: token, userId };
        } catch {
          // skip malformed entries
        }
      }
    }
    return null;
  });

  if (!session) {
    throw new Error("No Supabase session found in localStorage");
  }
  return session;
}

/**
 * Retrieve the Supabase access token from the page's localStorage.
 */
export async function getAccessToken(page: Page): Promise<string> {
  const { accessToken } = await getSupabaseSession(page);
  return accessToken;
}

/**
 * Ping the backend health endpoint and wait until it responds.
 * Throws a clear error if the backend is unreachable.
 */
export async function waitForBackend(
  page: Page,
  timeoutMs = TIMEOUTS.API,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const resp = await page.request.get(`${BACKEND_URL}/api/health`);
      if (resp.ok()) return;
    } catch {
      // backend not ready yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(
    `Backend not reachable at ${BACKEND_URL}/api/health after ${timeoutMs}ms. Is it running?`,
  );
}

/**
 * Generate a report via the backend API, then save it directly to
 * Supabase via the PostgREST API. Much faster than the full UI flow
 * because it skips search, profile navigation, and loading animations.
 *
 * Requires the backend to be running (MOCK_AI=true for deterministic data).
 */
export async function seedReportViaApi(
  page: Page,
  username: string,
): Promise<void> {
  const { accessToken, userId } = await getSupabaseSession(page);
  const { url: supabaseUrl, anonKey } = getSupabaseConfig();

  // 1. Generate the report data via the backend API
  const analyzeResp = await page.request.post(
    `${BACKEND_URL}/api/analyze/${encodeURIComponent(username)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!analyzeResp.ok()) {
    const body = await analyzeResp.text();
    throw new Error(`generate report failed: ${analyzeResp.status()} ${body}`);
  }
  const json = (await analyzeResp.json()) as {
    success?: boolean;
    data?: { analyzedName: string | null; report: Record<string, unknown> };
  };
  const { analyzedName, report } = json.data ?? (json as never);

  // 2. Upsert the report into Supabase via PostgREST
  const reportRow = {
    user_id: userId,
    analyzed_username: username.toLowerCase(),
    analyzed_name: analyzedName,
    overall_score: (report as { overallScore?: number }).overallScore,
    recommendation: (report as { recommendation?: string }).recommendation,
    report_data: report,
  };

  const upsertResp = await page.request.post(
    `${supabaseUrl}/rest/v1/reports`,
    {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      data: reportRow,
    },
  );

  if (!upsertResp.ok()) {
    const body = await upsertResp.text();
    throw new Error(`supabase upsert failed: ${upsertResp.status()} ${body}`);
  }
}

/**
 * Generate a report for the given GitHub username via the backend API.
 * NOTE: This only returns data — it does NOT save to Supabase.
 * Use seedReportViaApi() to both generate and persist.
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
 * This is the slowest seed approach but exercises the full user journey.
 * Prefer seedReportViaApi() for speed when only a persisted report is needed.
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
  await resultCard.waitFor({ timeout: TIMEOUTS.API });
  await resultCard.click();

  // Wait for profile page
  await page.waitForURL(new RegExp(`/profile/${username}`, "i"));

  // Click Start Analysis
  const analysisBtn = page.getByRole("button", { name: /start analysis/i });
  await analysisBtn.waitFor({ timeout: TIMEOUTS.ELEMENT });
  await analysisBtn.click();

  // Handle "report already exists" dialog
  const replaceBtn = page.getByRole("button", { name: /replace report/i });
  const isReplaceVisible = await replaceBtn
    .waitFor({ state: "visible", timeout: TIMEOUTS.DIALOG })
    .then(() => true)
    .catch(() => false);
  if (isReplaceVisible) {
    await replaceBtn.click();
  }

  // Wait for report generation to complete and redirect
  await page.waitForURL(/\/report\//, { timeout: TIMEOUTS.ANALYSIS });
}

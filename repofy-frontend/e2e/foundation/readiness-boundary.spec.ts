import { test, expect } from "@playwright/test";

for (const path of ["/readiness", "/readiness/new", "/readiness/jobs/synthetic-job", "/readiness/synthetic-report"]) {
  test(`${path} redirects visitors without a session cookie`, async ({ request }) => {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(new URL(response.headers().location, response.url()).pathname).toBe("/login");
  });

  test(`${path} renders a safe signed-out, unavailable intake or invalid-ID state behind the page guard`, async ({ request }) => {
    // Existing middleware only checks cookie presence. This is not authentication evidence;
    // the stub returns no user/data and backend access controls are tested independently.
    const response = await request.get(path, { headers: { Cookie: "access_token=synthetic-page-guard" }, maxRedirects: 0 });
    const html = await response.text();
    if (path.includes("synthetic-")) {
      // A loading boundary can start the HTML stream before notFound() resolves.
      // Both transports must render the not-found UI, never a report or job.
      expect([200, 404]).toContain(response.status());
      expect(html).toContain("Page not found");
      expect(html).not.toContain("Your project evidence");
      expect(html).not.toContain("Analysis progress");
    } else expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toContain("no-store");
    if (path === "/readiness/new") expect(html).toContain("New analyses are not available yet.");
    if (path === "/readiness") expect(html).toContain("Sign in to view your private readiness reports.");
    expect(html).not.toContain("Synthetic compatibility fixture");
    expect(html).not.toContain("<form");
  });
}

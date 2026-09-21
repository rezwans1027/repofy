import { expect, it, vi } from "vitest";
import * as Sentry from "@sentry/node";
import { initSentry, isGitHubConnectionTelemetry } from "../../../src/lib/sentry";
vi.mock("@sentry/node", () => ({ init: vi.fn() }));
it("drops connection URLs, OAuth codes, provider breadcrumbs and private discovery transactions", () => {
  vi.stubEnv("SENTRY_DSN", "https://synthetic.example/1");
  initSentry();
  const options = vi.mocked(Sentry.init).mock.calls[0][0]!;
  const event = { request: { url: "https://repofy.example/api/v1/github/installations/authorize?code=sentinel" } };
  expect(options.beforeSend!(event, {})).toBeNull();
  expect(options.beforeSendTransaction!({ ...event, type: "transaction" }, {})).toBeNull();
  expect(options.beforeBreadcrumb!({ data: { url: "https://api.github.com/repos/fixture/private" } }, {})).toBeNull();
  expect(options.beforeBreadcrumb!({ data: { url: "https://api.openai.com/v1/responses", request_body: "private-model-input" } }, {})).toBeNull();
  expect(options.beforeSend!({ request: { url: "https://api.openai.com/v1/responses" } }, {})).toBeNull();
  expect(options.beforeBreadcrumb!({ data: { url: "https://codeload.github.com/fixture/private/legacy.tar.gz/sha?token=sentinel" } }, {})).toBeNull();
  expect(options.beforeSendTransaction!({ type: "transaction", transaction: "worker.snapshot", spans: [
    { trace_id: "a".repeat(32), span_id: "b".repeat(16), start_timestamp: 1, timestamp: 2,
      description: "GET https://codeload.github.com/fixture/private/legacy.tar.gz/sha?token=sentinel" },
  ] }, {})).toBeNull();
  expect(options.beforeSendTransaction!({ type: "transaction", transaction: "worker.snapshot", spans: [
    { trace_id: "a".repeat(32), span_id: "b".repeat(16), start_timestamp: 1, timestamp: 2,
      data: { "http.url": "https://api.github.com/repos/fixture/private/tarball/sha" } },
  ] }, {})).toBeNull();
  expect(isGitHubConnectionTelemetry("/api/v1/repositories?accountId=fixture")).toBe(true);
  expect(options.beforeSend!({ request: { url: "https://repofy.example/api/v1/finding-feedback/review", data: "PRIVATE_COMMENT_SENTINEL" } }, {})).toBeNull();
  expect(isGitHubConnectionTelemetry("/API/V1/GITHUB/installations/authorize?code=sentinel")).toBe(true);
  const other = { request: { url: "https://repofy.example/api/health" } };
  expect(options.beforeSend!(other, {})).toBe(other);
  vi.unstubAllEnvs();
});

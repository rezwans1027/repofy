process.env.SUPABASE_URL = "http://localhost:54321";
process.env.SUPABASE_SERVICE_ROLE_KEY = "fake-service-role-key";
process.env.GITHUB_TOKEN = "fake-github-token";
process.env.OPENAI_API_KEY = "fake-openai-key";
process.env.STRIPE_SECRET_KEY = "sk_test_fake_key";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_fake_secret";
process.env.NODE_ENV = "test";

import { afterEach, vi } from "vitest";
afterEach(() => {
  vi.restoreAllMocks();
});

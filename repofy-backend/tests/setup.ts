process.env.TOKEN_ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

// Dummy values for testing only — not real API keys or production credentials.
process.env.SUPABASE_URL = "http://localhost:54321";
process.env.SUPABASE_SERVICE_ROLE_KEY = "fake-service-role-key";
process.env.SUPABASE_ANON_KEY = "fake-anon-key";
process.env.OPENAI_API_KEY = "fake-openai-key";
process.env.STRIPE_SECRET_KEY = "sk_test_fake_key";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_fake_secret";
process.env.RESEND_API_KEY = "re_fake_resend_key";
process.env.FEEDBACK_NOTIFICATION_EMAIL = "feedback@test.com";
process.env.ADMIN_SECRET = "fake-admin-secret";
process.env.ENGINE_INTERNAL_KEY = "fake-engine-key";
process.env.NODE_ENV = "test";

import { afterEach, vi } from "vitest";
afterEach(() => {
  vi.restoreAllMocks();
});

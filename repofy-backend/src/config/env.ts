import dotenv from "dotenv";

dotenv.config();

const _mockAi = process.env.MOCK_AI === "true" && process.env.NODE_ENV !== "production";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  if (/^<.*>$/.test(value)) {
    throw new Error(`Environment variable ${name} contains a placeholder value — replace it with a real secret`);
  }
  return value;
}

/** Require env var only when MOCK_AI is disabled (real AI calls needed). */
function requireEnvUnlessMockAi(name: string): string | undefined {
  if (_mockAi) return process.env[name];
  return requireEnv(name);
}

if (!process.env.NODE_ENV) {
  console.warn("WARNING: NODE_ENV is not set — defaulting to \"production\" for safety");
}

const _isProduction = (process.env.NODE_ENV ?? "production") === "production";

export const env = {
  port: parseInt(process.env.PORT || "3001", 10),
  corsOrigin: _isProduction ? requireEnv("CORS_ORIGIN") : (process.env.CORS_ORIGIN || "http://localhost:3000"),
  nodeEnv: process.env.NODE_ENV ?? "production",
  isProduction: _isProduction,
  trustProxy: _isProduction ? process.env.TRUST_PROXY !== "false" : process.env.TRUST_PROXY === "true",
  mockAi: _mockAi,
  supabaseUrl: requireEnv("SUPABASE_URL"),
  supabaseServiceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  githubToken: requireEnvUnlessMockAi("GITHUB_TOKEN"),
  openaiModel: process.env.OPENAI_MODEL || "gpt-5.1",
  adminSecret: requireEnv("ADMIN_SECRET"),
  frontendUrl: _isProduction
    ? (process.env.FRONTEND_URL || requireEnv("CORS_ORIGIN"))
    : (process.env.FRONTEND_URL || process.env.CORS_ORIGIN || "http://localhost:3000"),
  stripeSecretKey: requireEnv("STRIPE_SECRET_KEY"),
  stripeWebhookSecret: requireEnv("STRIPE_WEBHOOK_SECRET"),
  resendApiKey: requireEnv("RESEND_API_KEY"),
  otpHmacSecret: requireEnv("OTP_HMAC_SECRET"),
  engineUrl: process.env.ENGINE_URL || "http://localhost:3002",
  engineInternalKey: requireEnvUnlessMockAi("ENGINE_INTERNAL_KEY") ?? "",
} as const;

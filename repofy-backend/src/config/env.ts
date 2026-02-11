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
function requireEnvUnlessMockAi(name: string): string {
  if (_mockAi) return process.env[name] || "";
  return requireEnv(name);
}

export const env = {
  port: parseInt(process.env.PORT || "3003", 10),
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:3002",
  nodeEnv: process.env.NODE_ENV || "development",
  isProduction: process.env.NODE_ENV === "production",
  trustProxy: process.env.TRUST_PROXY === "true",
  mockAi: _mockAi,
  supabaseUrl: requireEnv("SUPABASE_URL"),
  supabaseServiceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  githubToken: requireEnv("GITHUB_TOKEN"),
  openaiApiKey: requireEnvUnlessMockAi("OPENAI_API_KEY"),
  openaiModel: process.env.OPENAI_MODEL || "gpt-4o",
} as const;

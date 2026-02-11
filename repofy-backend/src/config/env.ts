import dotenv from "dotenv";

dotenv.config();

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

export const env = {
  port: parseInt(process.env.PORT || "3003", 10),
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:3002",
  nodeEnv: process.env.NODE_ENV || "development",
  isProduction: process.env.NODE_ENV === "production",
  trustProxy: process.env.TRUST_PROXY === "true",
  mockAi: process.env.MOCK_AI === "true" && process.env.NODE_ENV !== "production",
  supabaseUrl: requireEnv("SUPABASE_URL"),
  supabaseServiceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  githubToken: requireEnv("GITHUB_TOKEN"),
  openaiApiKey: requireEnv("OPENAI_API_KEY"),
  openaiModel: process.env.OPENAI_MODEL || "gpt-4o",
} as const;

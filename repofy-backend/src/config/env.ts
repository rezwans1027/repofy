import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: parseInt(process.env.PORT || "3003", 10),
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:3002",
  nodeEnv: process.env.NODE_ENV || "development",
  isProduction: process.env.NODE_ENV === "production",
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  supabaseJwtSecret: process.env.SUPABASE_JWT_SECRET || "",
  githubToken: process.env.GITHUB_TOKEN || "",
  openaiApiKey: process.env.OPENAI_API_KEY || "",
} as const;

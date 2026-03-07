import cors from "cors";
import { env } from "../config/env";

const allowedOrigins = env.corsOrigin.split(",").map((o) => o.trim());

export const corsMiddleware = cors({
  origin(origin, callback) {
    // In production, reject requests without an Origin header (e.g. direct curl).
    // Health checks still work — they just won't get CORS headers.
    if (!origin) {
      if (env.isProduction) return callback(null, false);
      return callback(null, true);
    }

    // Exact match against CORS_ORIGIN list
    if (allowedOrigins.includes(origin)) return callback(null, true);

    callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
});

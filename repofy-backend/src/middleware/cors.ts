import cors from "cors";
import { env } from "../config/env";

const allowedOrigins = env.corsOrigin.split(",").map((o) => o.trim());

export const corsMiddleware = cors({
  origin(origin, callback) {
    // Allow server-to-server requests (no origin)
    if (!origin) return callback(null, true);

    // Exact match against CORS_ORIGIN list
    if (allowedOrigins.includes(origin)) return callback(null, true);

    callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
});

import cors from "cors";
import { env } from "../config/env";

export const corsMiddleware = cors({
  origin: env.corsOrigin,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
});

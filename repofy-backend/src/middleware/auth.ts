import { RequestHandler } from "express";
import { getSupabaseAdmin } from "../config/supabase";
import { sendError } from "../lib/response";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
      signal?: AbortSignal;
    }
  }
}

export const requireAuth: RequestHandler = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    sendError(res, 401, "Missing or invalid authorization header");
    return;
  }

  const token = authHeader.split(" ")[1];

  const { data, error } = await getSupabaseAdmin().auth.getUser(token);

  if (error || !data.user) {
    sendError(res, 401, "Invalid or expired token");
    return;
  }

  req.userId = data.user.id;
  req.userEmail = data.user.email;
  next();
};

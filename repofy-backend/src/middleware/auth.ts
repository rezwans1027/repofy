import { RequestHandler } from "express";
import { supabaseAdmin } from "../config/supabase";
import { ApiResponse } from "../types";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
    }
  }
}

export const requireAuth: RequestHandler = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    const response: ApiResponse = {
      success: false,
      error: "Missing or invalid authorization header",
    };
    res.status(401).json(response);
    return;
  }

  const token = authHeader.split(" ")[1];

  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) {
    const response: ApiResponse = {
      success: false,
      error: "Invalid or expired token",
    };
    res.status(401).json(response);
    return;
  }

  req.userId = data.user.id;
  req.userEmail = data.user.email;
  next();
};

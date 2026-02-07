import { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { ApiResponse } from "../types";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
    }
  }
}

export const requireAuth: RequestHandler = (req, res, next) => {
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

  try {
    const payload = jwt.verify(token, env.supabaseJwtSecret) as jwt.JwtPayload;
    req.userId = payload.sub;
    req.userEmail = payload.email;
    next();
  } catch {
    const response: ApiResponse = {
      success: false,
      error: "Invalid or expired token",
    };
    res.status(401).json(response);
  }
};

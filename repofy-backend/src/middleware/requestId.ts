import crypto from "crypto";
import type { RequestHandler } from "express";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

export const requestId: RequestHandler = (req, _res, next) => {
  req.requestId = (req.headers["x-request-id"] as string) || crypto.randomUUID();
  next();
};

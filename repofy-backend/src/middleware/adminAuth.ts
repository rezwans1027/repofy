import crypto from "crypto";
import { RequestHandler } from "express";
import { env } from "../config/env";
import { sendError } from "../lib/response";

export const requireAdminKey: RequestHandler = (req, res, next) => {
  const key = req.headers["x-admin-key"];
  if (
    !env.adminSecret ||
    typeof key !== "string" ||
    key.length !== env.adminSecret.length ||
    !crypto.timingSafeEqual(Buffer.from(key), Buffer.from(env.adminSecret))
  ) {
    sendError(res, 401, "Unauthorized");
    return;
  }
  next();
};

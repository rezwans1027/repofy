import crypto from "crypto";
import { RequestHandler } from "express";
import { env } from "../config/env";
import { sendError } from "../lib/response";

export const requireAdminKey: RequestHandler = (req, res, next) => {
  const key = req.headers["x-admin-key"];
  if (
    !env.adminSecret ||
    typeof key !== "string" ||
    !crypto.timingSafeEqual(
      crypto.createHash("sha256").update(key).digest(),
      crypto.createHash("sha256").update(env.adminSecret).digest(),
    )
  ) {
    sendError(res, 401, "Unauthorized");
    return;
  }
  next();
};

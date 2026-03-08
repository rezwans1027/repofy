import crypto from "crypto";
import { RequestHandler } from "express";
import { env } from "../config/env";
import { sendError } from "../lib/response";

const adminSecretHash = env.adminSecret
  ? crypto.createHash("sha256").update(env.adminSecret).digest()
  : null;

export const requireAdminKey: RequestHandler = (req, res, next) => {
  const key = req.headers["x-admin-key"];
  if (
    !adminSecretHash ||
    typeof key !== "string" ||
    !crypto.timingSafeEqual(
      crypto.createHash("sha256").update(key).digest(),
      adminSecretHash,
    )
  ) {
    sendError(res, 401, "Unauthorized");
    return;
  }
  next();
};

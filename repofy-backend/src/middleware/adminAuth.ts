import { RequestHandler } from "express";
import { env } from "../config/env";
import { sendError } from "../lib/response";

export const requireAdminKey: RequestHandler = (req, res, next) => {
  const key = req.headers["x-admin-key"];
  if (!env.adminSecret || key !== env.adminSecret) {
    sendError(res, 401, "Unauthorized");
    return;
  }
  next();
};

import { ErrorRequestHandler } from "express";
import { env } from "../config/env";
import { sendError } from "../lib/response";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const status = err.status || 500;
  const message = env.isProduction ? "Internal server error" : err.message;

  sendError(res, status, message);
};

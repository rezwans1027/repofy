import { ErrorRequestHandler } from "express";
import { env } from "../config/env";
import { ApiResponse } from "../types";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const status = err.status || 500;
  const message = env.isProduction ? "Internal server error" : err.message;

  const response: ApiResponse = {
    success: false,
    error: message,
  };

  res.status(status).json(response);
};

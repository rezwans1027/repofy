import { RequestHandler } from "express";
import { ApiResponse } from "../types";

export const notFound: RequestHandler = (_req, res) => {
  const response: ApiResponse = {
    success: false,
    error: "Not found",
  };

  res.status(404).json(response);
};

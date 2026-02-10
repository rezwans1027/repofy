import { RequestHandler } from "express";
import { sendError } from "../lib/response";

export const notFound: RequestHandler = (_req, res) => {
  sendError(res, 404, "Not found");
};

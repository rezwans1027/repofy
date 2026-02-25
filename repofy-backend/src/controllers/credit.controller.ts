import { RequestHandler } from "express";
import { getCreditBalance } from "../services/credit.service";
import { sendError, sendSuccess } from "../lib/response";
import { logger } from "../lib/logger";

export const getBalance: RequestHandler = async (req, res) => {
  const userId = req.userId;

  if (!userId) {
    sendError(res, 401, "Authentication required");
    return;
  }

  try {
    const balance = await getCreditBalance(userId);
    sendSuccess(res, balance);
  } catch (err) {
    logger.error("Credit balance error:", err);
    sendError(res, 500, "Failed to fetch credit balance");
  }
};

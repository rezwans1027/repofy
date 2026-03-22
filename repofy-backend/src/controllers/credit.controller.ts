import { RequestHandler } from "express";
import { getCreditBalance, getTransactionHistory } from "../services/credit.service";
import { sendSuccess } from "../lib/response";
import { handleControllerError } from "../lib/controller-utils";
import type { AuthenticatedRequest } from "../types";

export const getBalance: RequestHandler = async (req, res) => {
  const { userId } = req as AuthenticatedRequest;

  try {
    const balance = await getCreditBalance(userId);
    sendSuccess(res, balance);
  } catch (err) {
    handleControllerError(err, req, res, "Credit Balance", "Failed to fetch credit balance");
  }
};

export const getHistory: RequestHandler = async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  try {
    const result = await getTransactionHistory(userId, limit, offset);
    sendSuccess(res, result);
  } catch (err) {
    handleControllerError(err, req, res, "Credit History", "Failed to fetch transaction history");
  }
};

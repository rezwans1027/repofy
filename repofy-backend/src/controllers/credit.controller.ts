import { RequestHandler } from "express";
import { getCreditBalance } from "../services/credit.service";
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

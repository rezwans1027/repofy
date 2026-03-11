import { RequestHandler } from "express";
import { listAdvice, getAdviceById, adviceExists, deleteAdvice } from "../services/advice-persistence.service";
import { sendError, sendSuccess } from "../lib/response";
import { logger } from "../lib/logger";

export const getAdviceList: RequestHandler = async (req, res) => {
  if (!req.userId) { sendError(res, 401, "Authentication required"); return; }
  try {
    const data = await listAdvice(req.userId);
    sendSuccess(res, data);
  } catch (err) {
    logger.error("List advice error:", err);
    sendError(res, 500, "Failed to fetch advice");
  }
};

export const getAdviceDetail: RequestHandler = async (req, res) => {
  if (!req.userId) { sendError(res, 401, "Authentication required"); return; }
  try {
    const data = await getAdviceById(req.userId, String(req.params.id));
    if (!data) { sendError(res, 404, "Advice not found"); return; }
    sendSuccess(res, data);
  } catch (err) {
    logger.error("Get advice error:", err);
    sendError(res, 500, "Failed to fetch advice");
  }
};

export const checkAdviceExists: RequestHandler = async (req, res) => {
  if (!req.userId) { sendError(res, 401, "Authentication required"); return; }
  try {
    const exists = await adviceExists(req.userId, String(req.params.username));
    sendSuccess(res, exists);
  } catch (err) {
    logger.error("Check advice exists error:", err);
    sendError(res, 500, "Failed to check advice");
  }
};

export const removeAdvice: RequestHandler = async (req, res) => {
  if (!req.userId) { sendError(res, 401, "Authentication required"); return; }
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id: unknown) => typeof id === "string")) {
    sendError(res, 400, "ids must be a non-empty array of strings");
    return;
  }
  try {
    await deleteAdvice(req.userId, ids);
    sendSuccess(res, null);
  } catch (err) {
    logger.error("Delete advice error:", err);
    sendError(res, 500, "Failed to delete advice");
  }
};

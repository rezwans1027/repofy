import { RequestHandler } from "express";
import { listReports, getReportById, reportExists, deleteReports } from "../services/reports.service";
import { sendError, sendSuccess } from "../lib/response";
import { logger } from "../lib/logger";

export const getReports: RequestHandler = async (req, res) => {
  if (!req.userId) { sendError(res, 401, "Authentication required"); return; }
  try {
    const data = await listReports(req.userId);
    sendSuccess(res, data);
  } catch (err) {
    logger.error("List reports error:", err);
    sendError(res, 500, "Failed to fetch reports");
  }
};

export const getReport: RequestHandler = async (req, res) => {
  if (!req.userId) { sendError(res, 401, "Authentication required"); return; }
  try {
    const data = await getReportById(req.userId, String(req.params.id));
    if (!data) { sendError(res, 404, "Report not found"); return; }
    sendSuccess(res, data);
  } catch (err) {
    logger.error("Get report error:", err);
    sendError(res, 500, "Failed to fetch report");
  }
};

export const checkReportExists: RequestHandler = async (req, res) => {
  if (!req.userId) { sendError(res, 401, "Authentication required"); return; }
  try {
    const exists = await reportExists(req.userId, String(req.params.username));
    sendSuccess(res, exists);
  } catch (err) {
    logger.error("Check report exists error:", err);
    sendError(res, 500, "Failed to check report");
  }
};

export const removeReports: RequestHandler = async (req, res) => {
  if (!req.userId) { sendError(res, 401, "Authentication required"); return; }
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id: unknown) => typeof id === "string")) {
    sendError(res, 400, "ids must be a non-empty array of strings");
    return;
  }
  try {
    await deleteReports(req.userId, ids);
    sendSuccess(res, null);
  } catch (err) {
    logger.error("Delete reports error:", err);
    sendError(res, 500, "Failed to delete reports");
  }
};

import { RequestHandler } from "express";
import { createCrudController } from "./crud.controller";
import { listAdvice, getAdviceById, adviceCount, deleteAdvice } from "../services/advice-persistence.service";
import { getActiveJob, getJobById, expireStaleJobs } from "../services/advice-job.service";
import { sendSuccess, sendError } from "../lib/response";
import { UUID_RE } from "../lib/validators";
import type { AuthenticatedRequest } from "../types";

const crud = createCrudController({
  service: { list: listAdvice, getById: getAdviceById, count: adviceCount, deleteBatch: deleteAdvice },
  entityName: "advice",
});

export const getAdviceList = crud.list;
export const getAdviceDetail = crud.getById;
export const checkAdviceCount = crud.count;
export const removeAdvice = crud.deleteBatch;

export const getActiveAdviceJob: RequestHandler = async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  await expireStaleJobs(userId);
  const job = await getActiveJob(userId);
  sendSuccess(res, job);
};

export const getAdviceJobStatus: RequestHandler = async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const jobId = req.params.jobId as string;
  if (!UUID_RE.test(jobId)) {
    sendError(res, 400, "Invalid job ID format");
    return;
  }
  const job = await getJobById(jobId, userId);
  if (!job) {
    sendError(res, 404, "Job not found");
    return;
  }
  sendSuccess(res, job);
};

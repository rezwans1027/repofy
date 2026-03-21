import { createCrudController } from "./crud.controller";
import { listReports, getReportById, reportCount, deleteReports } from "../services/reports.service";

const crud = createCrudController({
  service: { list: listReports, getById: getReportById, count: reportCount, deleteBatch: deleteReports },
  entityName: "report",
});

export const getReports = crud.list;
export const getReport = crud.getById;
export const checkReportCount = crud.count;
export const removeReports = crud.deleteBatch;

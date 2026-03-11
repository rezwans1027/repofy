import { createCrudController } from "./crud.controller";
import { listReports, getReportById, reportExists, deleteReports } from "../services/reports.service";

const crud = createCrudController({
  service: { list: listReports, getById: getReportById, exists: reportExists, deleteBatch: deleteReports },
  entityName: "report",
});

export const getReports = crud.list;
export const getReport = crud.getById;
export const checkReportExists = crud.exists;
export const removeReports = crud.deleteBatch;

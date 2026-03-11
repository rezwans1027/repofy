import { createCrudController } from "./crud.controller";
import { listAdvice, getAdviceById, adviceExists, deleteAdvice } from "../services/advice-persistence.service";

const crud = createCrudController({
  service: { list: listAdvice, getById: getAdviceById, exists: adviceExists, deleteBatch: deleteAdvice },
  entityName: "advice",
});

export const getAdviceList = crud.list;
export const getAdviceDetail = crud.getById;
export const checkAdviceExists = crud.exists;
export const removeAdvice = crud.deleteBatch;

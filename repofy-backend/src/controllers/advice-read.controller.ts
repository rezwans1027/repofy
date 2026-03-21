import { createCrudController } from "./crud.controller";
import { listAdvice, getAdviceById, adviceCount, deleteAdvice } from "../services/advice-persistence.service";

const crud = createCrudController({
  service: { list: listAdvice, getById: getAdviceById, count: adviceCount, deleteBatch: deleteAdvice },
  entityName: "advice",
});

export const getAdviceList = crud.list;
export const getAdviceDetail = crud.getById;
export const checkAdviceCount = crud.count;
export const removeAdvice = crud.deleteBatch;

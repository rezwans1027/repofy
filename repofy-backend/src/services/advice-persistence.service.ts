import { createCrudService } from "./crud.service";

export class InsufficientCreditsError extends Error {
  constructor() {
    super("Insufficient growth credits");
    this.name = "InsufficientCreditsError";
  }
}

const crud = createCrudService({
  table: "advice",
  entityName: "advice",
  listSelect: "id, analyzed_username, analyzed_name, avatar_url, generated_at",
  detailSelect: "id, analyzed_username, avatar_url, advice_data",
  existsColumn: "analyzed_username",
});

export const listAdvice = crud.list;
export const getAdviceById = crud.getById;
export const adviceCount = crud.count;
export const deleteAdvice = crud.deleteBatch;

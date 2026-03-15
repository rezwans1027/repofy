import { z } from "zod";
import { createCrudHooks } from "./use-crud";
import type { AdviceData } from "@shared/types/advice";

const adviceListItemSchema = z.object({
  id: z.string(),
  analyzed_username: z.string(),
  generated_at: z.string(),
  analyzed_name: z.string().nullable(),
});

const adviceRowSchema = z.object({
  id: z.string(),
  analyzed_username: z.string(),
  user_id: z.string(),
  advice_data: z.object({
    schemaVersion: z.literal("v2"),
    summary: z.string(),
    trajectory: z.object({ currentEstimate: z.string(), targetEstimate: z.string(), confidence: z.string() }).passthrough(),
    buildRoadmap: z.array(z.object({ title: z.string() }).passthrough()),
    skillRoadmap: z.array(z.object({ skill: z.string() }).passthrough()),
    repoImprovements: z.array(z.object({ repoName: z.string() }).passthrough()),
  }).passthrough(),
});

export type AdviceListItem = z.infer<typeof adviceListItemSchema>;

type AdviceRow = z.infer<typeof adviceRowSchema> & { advice_data: AdviceData };

const crud = createCrudHooks<AdviceListItem>({
  queryKey: "advice",
  endpoint: "/advice",
  listSchema: z.array(adviceListItemSchema),
  detailSchema: adviceRowSchema,
});

export const useAdviceList = crud.useList;
export const useAdvice = crud.useDetail;
export const useExistingAdvice = crud.useExists;
export const useDeleteAdvice = crud.useDelete;

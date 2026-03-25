import { z } from "zod";
import { createCrudHooks } from "./use-crud";

const adviceListItemSchema = z.object({
  id: z.string(),
  analyzed_username: z.string(),
  generated_at: z.string(),
  analyzed_name: z.string().nullable(),
  avatar_url: z.string().nullable().optional().default(null),
});

const adviceRowSchema = z.object({
  id: z.string(),
  analyzed_username: z.string(),
  avatar_url: z.string().nullable().optional().default(null),
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

const crud = createCrudHooks<AdviceListItem>({
  queryKey: "advice",
  endpoint: "/advice",
  listSchema: z.array(adviceListItemSchema),
  detailSchema: adviceRowSchema,
});

export const useAdviceList = crud.useList;
export const useAdvice = crud.useDetail;
export const useAdviceCount = crud.useCount;
export const useDeleteAdvice = crud.useDelete;

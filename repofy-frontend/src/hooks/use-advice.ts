import { createSupabaseQueries } from "@/lib/supabase-queries";
import type { AdviceData } from "@/components/advice/advice-report";

export interface AdviceListItem {
  id: string;
  analyzed_username: string;
  generated_at: string;
  analyzed_name: string | null;
}

interface AdviceRow {
  id: string;
  analyzed_username: string;
  user_id: string;
  advice_data: AdviceData;
}

const adviceQueries = createSupabaseQueries<AdviceListItem, AdviceRow>({
  table: "advice",
  queryKeyPrefix: "advice",
  listSelect: "id, analyzed_username, analyzed_name, generated_at",
  detailSelect: "id, analyzed_username, user_id, advice_data",
});

export const useAdviceList = adviceQueries.useList;
export const useAdvice = adviceQueries.useById;
export const useExistingAdvice = adviceQueries.useExisting;
export const useDeleteAdvice = adviceQueries.useDelete;

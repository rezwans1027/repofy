import { getSupabaseAdmin } from "../config/supabase";
import { throwIfDbError } from "../lib/errors";

const DEFAULT_PAGE_LIMIT = 50;
const MAX_PAGE_LIMIT = 200;

interface CrudServiceConfig {
  table: string;
  entityName: string;
  listSelect: string;
  detailSelect: string;
  /** Column used for exists check (typically "analyzed_username") */
  existsColumn: string;
}

export function createCrudService(config: CrudServiceConfig) {
  const { table, entityName, listSelect, detailSelect, existsColumn } = config;

  async function list(userId: string, limit = DEFAULT_PAGE_LIMIT, offset = 0) {
    const clamped = Math.min(Math.max(1, limit), MAX_PAGE_LIMIT);
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from(table)
      .select(listSelect)
      .eq("user_id", userId)
      .order("generated_at", { ascending: false })
      .range(offset, offset + clamped - 1);
    throwIfDbError(error, `list ${entityName}`);
    return data ?? [];
  }

  async function getById(userId: string, id: string) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from(table)
      .select(detailSelect)
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();
    throwIfDbError(error, `get ${entityName}`);
    return data;
  }

  async function exists(userId: string, value: string): Promise<boolean> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from(table)
      .select("id")
      .eq("user_id", userId)
      .eq(existsColumn, value.toLowerCase())
      .limit(1);
    throwIfDbError(error, `check ${entityName} exists`);
    return !!data && data.length > 0;
  }

  async function deleteBatch(userId: string, ids: string[]) {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from(table)
      .delete()
      .in("id", ids)
      .eq("user_id", userId);
    throwIfDbError(error, `delete ${entityName}`);
  }

  return { list, getById, exists, deleteBatch };
}

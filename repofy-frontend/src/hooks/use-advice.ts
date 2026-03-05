import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/auth-provider";
import type { AdviceData } from "@/components/advice/advice-report";

const STALE_TIME = 5 * 60 * 1000; // 5 minutes

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

export function useAdviceList() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["advice", "list", user?.id],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("advice")
        .select("id, analyzed_username, analyzed_name, generated_at")
        .eq("user_id", user!.id)
        .order("generated_at", { ascending: false });
      if (error) throw error;
      return (data as AdviceListItem[]) ?? [];
    },
    enabled: !!user,
    staleTime: STALE_TIME,
  });
}

export function useAdvice(id: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["advice", "detail", user?.id, id],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("advice")
        .select("id, analyzed_username, user_id, advice_data")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as AdviceRow;
    },
    enabled: !!user && !!id,
  });
}

export function useExistingAdvice(username: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["advice", "exists", user?.id, username.toLowerCase()],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("advice")
        .select("id")
        .eq("user_id", user!.id)
        .eq("analyzed_username", username.toLowerCase())
        .limit(1);
      if (error) throw error;
      return data && data.length > 0;
    },
    enabled: !!user,
  });
}

export function useDeleteAdvice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const supabase = createClient();
      const { error } = await supabase.from("advice").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["advice"] });
    },
  });
}

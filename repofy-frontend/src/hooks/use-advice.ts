import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/auth-provider";
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

export function useAdviceList() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["advice", "list", user?.id],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("advice")
        .select("id, analyzed_username, analyzed_name, generated_at")
        .order("generated_at", { ascending: false });
      if (error) throw error;
      return (data as AdviceListItem[]) ?? [];
    },
    enabled: !!user,
    staleTime: 0,
  });
}

export function useAdvice(id: string) {
  return useQuery({
    queryKey: ["advice", "detail", id],
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
    enabled: !!id,
  });
}

export function useExistingAdvice(
  userId: string | undefined,
  username: string,
) {
  return useQuery({
    queryKey: ["advice", "exists", userId, username],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("advice")
        .select("id")
        .eq("user_id", userId!)
        .eq("analyzed_username", username)
        .limit(1);
      return data && data.length > 0;
    },
    enabled: !!userId,
  });
}

export function useDeleteAdvice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("advice")
        .delete()
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["advice"] });
    },
  });
}

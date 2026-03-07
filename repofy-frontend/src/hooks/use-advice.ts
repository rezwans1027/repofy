import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/auth-provider";
import { STALE_LONG } from "@/lib/query-client";
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
        .eq("user_id", user!.id)
        .order("generated_at", { ascending: false });
      if (error) throw error;
      return (data as AdviceListItem[]) ?? [];
    },
    enabled: !!user,
    staleTime: STALE_LONG,
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
        .eq("user_id", user!.id)
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
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (!user) throw new Error("Not authenticated");
      const supabase = createClient();
      const { error } = await supabase
        .from("advice")
        .delete()
        .in("id", ids)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: ["advice", "list", user?.id] });
      const previous = queryClient.getQueryData<AdviceListItem[]>(["advice", "list", user?.id]);
      if (previous) {
        const idSet = new Set(ids);
        queryClient.setQueryData<AdviceListItem[]>(
          ["advice", "list", user?.id],
          previous.filter((item) => !idSet.has(item.id)),
        );
      }
      return { previous };
    },
    onError: (_err, _ids, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["advice", "list", user?.id], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["advice"] });
    },
  });
}

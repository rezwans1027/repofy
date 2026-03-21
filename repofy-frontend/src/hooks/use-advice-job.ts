import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { useAuth } from "@/components/providers/auth-provider";
import { api } from "@/lib/api-client";

const adviceJobSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  analyzed_username: z.string(),
  status: z.enum(["processing", "completed", "failed"]),
  advice_id: z.string().nullable(),
  error: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type AdviceJob = z.infer<typeof adviceJobSchema>;

export function useActiveAdviceJob() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["advice", "jobs", "active"],
    queryFn: () => api.get<AdviceJob | null>("/advice/jobs/active", { schema: adviceJobSchema.nullable() }),
    enabled: !!user,
    staleTime: 0, // always refetch on mount — job state changes frequently
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && data.status === "processing") return 3000;
      return false;
    },
  });
}

export function useAdviceJob(jobId: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["advice", "jobs", jobId],
    queryFn: () => api.get<AdviceJob>(`/advice/jobs/${jobId}`, { schema: adviceJobSchema }),
    enabled: !!user && !!jobId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && data.status === "processing") return 3000;
      return false;
    },
  });
}

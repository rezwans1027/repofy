import { RequestHandler } from "express";
import { ApiResponse } from "../types";
import { getSupabaseAdmin } from "../config/supabase";

interface HealthData {
  status: string;
  timestamp: string;
  uptime: number;
}

interface ReadyData extends HealthData {
  checks: {
    supabase: "ok" | "fail";
  };
}

export const getHealth: RequestHandler = (_req, res) => {
  const response: ApiResponse<HealthData> = {
    success: true,
    data: {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
  };

  res.json(response);
};

export const getReady: RequestHandler = async (_req, res) => {
  let supabaseOk: boolean;

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .limit(1);
    supabaseOk = !error;
  } catch {
    supabaseOk = false;
  }

  const status = supabaseOk ? "ready" : "degraded";

  const response: ApiResponse<ReadyData> = {
    success: supabaseOk,
    data: {
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: {
        supabase: supabaseOk ? "ok" : "fail",
      },
    },
  };

  res.status(supabaseOk ? 200 : 503).json(response);
};

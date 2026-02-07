import { RequestHandler } from "express";
import { ApiResponse } from "../types";

interface HealthData {
  status: string;
  timestamp: string;
  uptime: number;
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

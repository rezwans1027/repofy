import { Response } from "express";
import { ApiResponse } from "../types";

export function sendError(res: Response, status: number, message: string): void {
  const response: ApiResponse = { success: false, error: message };
  res.status(status).json(response);
}

export function sendSuccess<T>(res: Response, data: T): void {
  const response: ApiResponse<T> = { success: true, data };
  res.json(response);
}

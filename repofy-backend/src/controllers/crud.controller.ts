import { RequestHandler } from "express";
import { sendError, sendSuccess } from "../lib/response";
import { handleControllerError } from "../lib/controller-utils";
import { MAX_DELETE_IDS } from "../lib/validators";
import type { AuthenticatedRequest } from "../types";

interface CrudServiceMethods {
  list: (userId: string, limit?: number, offset?: number) => Promise<unknown>;
  getById: (userId: string, id: string) => Promise<unknown>;
  exists: (userId: string, value: string) => Promise<boolean>;
  deleteBatch: (userId: string, ids: string[]) => Promise<void>;
}

interface CrudControllerConfig {
  service: CrudServiceMethods;
  entityName: string;
}

interface CrudController {
  list: RequestHandler;
  getById: RequestHandler;
  exists: RequestHandler;
  deleteBatch: RequestHandler;
}

export function createCrudController(config: CrudControllerConfig): CrudController {
  const { service, entityName } = config;
  const capName = entityName.charAt(0).toUpperCase() + entityName.slice(1);

  return {
    list: async (req, res) => {
      const { userId } = req as AuthenticatedRequest;
      const rawLimit = req.query.limit ? parseInt(String(req.query.limit), 10) : undefined;
      const rawOffset = req.query.offset ? parseInt(String(req.query.offset), 10) : undefined;
      const limit = rawLimit !== undefined && !Number.isNaN(rawLimit) ? rawLimit : undefined;
      const offset = rawOffset !== undefined && !Number.isNaN(rawOffset) ? rawOffset : undefined;
      try {
        const data = await service.list(userId, limit, offset);
        sendSuccess(res, data);
      } catch (err) {
        handleControllerError(err, req, res, `List ${capName}`, `Failed to fetch ${entityName}s`);
      }
    },

    getById: async (req, res) => {
      const { userId } = req as AuthenticatedRequest;
      try {
        const data = await service.getById(userId, String(req.params.id));
        if (!data) { sendError(res, 404, `${capName} not found`); return; }
        sendSuccess(res, data);
      } catch (err) {
        handleControllerError(err, req, res, `Get ${capName}`, `Failed to fetch ${entityName}`);
      }
    },

    exists: async (req, res) => {
      const { userId } = req as AuthenticatedRequest;
      try {
        const result = await service.exists(userId, String(req.params.username));
        sendSuccess(res, result);
      } catch (err) {
        handleControllerError(err, req, res, `Check ${capName}`, `Failed to check ${entityName}`);
      }
    },

    deleteBatch: async (req, res) => {
      const { userId } = req as AuthenticatedRequest;
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id: unknown) => typeof id === "string")) {
        sendError(res, 400, "ids must be a non-empty array of strings");
        return;
      }
      if (ids.length > MAX_DELETE_IDS) {
        sendError(res, 400, `Cannot delete more than ${MAX_DELETE_IDS} items at once`);
        return;
      }
      try {
        await service.deleteBatch(userId, ids);
        sendSuccess(res, null);
      } catch (err) {
        handleControllerError(err, req, res, `Delete ${capName}`, `Failed to delete ${entityName}s`);
      }
    },
  };
}

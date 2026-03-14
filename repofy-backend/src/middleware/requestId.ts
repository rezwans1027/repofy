import crypto from "crypto";
import type { RequestHandler } from "express";

const REQUEST_ID_RE = /^[a-zA-Z0-9\-]{1,128}$/;

export const requestId: RequestHandler = (req, _res, next) => {
  const clientId = req.headers["x-request-id"] as string | undefined;
  req.requestId = clientId && REQUEST_ID_RE.test(clientId) ? clientId : crypto.randomUUID();
  next();
};

import { RequestHandler } from "express";
import { sendSuccess, sendError } from "../lib/response";
import { initiateSignup, verifySignup, resendOtp, AuthError } from "../services/auth.service";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LEN = 254;
const MAX_DISPLAY_NAME_LEN = 100;
const MAX_PASSWORD_LEN = 128;

export const handleInitiateSignup: RequestHandler = async (req, res) => {
  const { email, displayName } = req.body;

  if (!email || typeof email !== "string" || email.length > MAX_EMAIL_LEN || !EMAIL_RE.test(email)) {
    return sendError(res, 400, "A valid email is required.");
  }
  if (!displayName || typeof displayName !== "string" || !displayName.trim() || displayName.length > MAX_DISPLAY_NAME_LEN) {
    return sendError(res, 400, "Display name is required (max 100 characters).");
  }

  try {
    const result = await initiateSignup(email.toLowerCase().trim(), displayName.trim());
    sendSuccess(res, result);
  } catch (err) {
    if (err instanceof AuthError) return sendError(res, err.status, err.message);
    sendError(res, 500, "An unexpected error occurred.");
  }
};

export const handleVerifySignup: RequestHandler = async (req, res) => {
  const { email, otp, password } = req.body;

  if (!email || typeof email !== "string") {
    return sendError(res, 400, "Email is required.");
  }
  if (!otp || typeof otp !== "string" || !/^\d{6}$/.test(otp)) {
    return sendError(res, 400, "A valid 6-digit verification code is required.");
  }
  if (!password || typeof password !== "string" || password.length < 8 || password.length > MAX_PASSWORD_LEN) {
    return sendError(res, 400, "Password must be 8–128 characters.");
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return sendError(res, 400, "Password must include at least 1 lowercase letter, 1 uppercase letter, and 1 number.");
  }

  try {
    const result = await verifySignup(email.toLowerCase().trim(), otp, password);
    sendSuccess(res, result);
  } catch (err) {
    if (err instanceof AuthError) return sendError(res, err.status, err.message);
    sendError(res, 500, "An unexpected error occurred.");
  }
};

export const handleResendOtp: RequestHandler = async (req, res) => {
  const { email } = req.body;

  if (!email || typeof email !== "string" || email.length > MAX_EMAIL_LEN || !EMAIL_RE.test(email)) {
    return sendError(res, 400, "A valid email is required.");
  }

  try {
    const result = await resendOtp(email.toLowerCase().trim());
    sendSuccess(res, result);
  } catch (err) {
    if (err instanceof AuthError) return sendError(res, err.status, err.message);
    sendError(res, 500, "An unexpected error occurred.");
  }
};

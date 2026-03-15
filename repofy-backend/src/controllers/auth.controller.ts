import { RequestHandler } from "express";
import { sendSuccess, sendError } from "../lib/response";
import { handleControllerError } from "../lib/controller-utils";
import { initiateSignup, verifySignup, resendOtp } from "../services/auth.service";
import { invalidateToken } from "../middleware/auth";
import { getSupabaseAdmin } from "../config/supabase";
import type { AuthenticatedRequest } from "../types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LEN = 254;
const MAX_DISPLAY_NAME_LEN = 100;
const MAX_PASSWORD_LEN = 128;

export const handleInitiateSignup: RequestHandler = async (req, res) => {
  const { email, displayName } = req.body;

  if (!email || typeof email !== "string" || email.length > MAX_EMAIL_LEN || !EMAIL_RE.test(email)) {
    sendError(res, 400, "A valid email is required.");
    return;
  }
  if (!displayName || typeof displayName !== "string" || !displayName.trim() || displayName.length > MAX_DISPLAY_NAME_LEN) {
    sendError(res, 400, "Display name is required (max 100 characters).");
    return;
  }

  try {
    const result = await initiateSignup(email.toLowerCase().trim(), displayName.trim());
    sendSuccess(res, result);
  } catch (err) {
    handleControllerError(err, req, res, "Auth Signup", "An unexpected error occurred.");
  }
};

export const handleVerifySignup: RequestHandler = async (req, res) => {
  const { email, otp, password } = req.body;

  if (!email || typeof email !== "string" || email.length > MAX_EMAIL_LEN || !EMAIL_RE.test(email)) {
    sendError(res, 400, "A valid email is required.");
    return;
  }
  if (!otp || typeof otp !== "string" || !/^\d{6}$/.test(otp)) {
    sendError(res, 400, "A valid 6-digit verification code is required.");
    return;
  }
  if (!password || typeof password !== "string" || password.length < 8 || password.length > MAX_PASSWORD_LEN) {
    sendError(res, 400, "Password must be 8–128 characters.");
    return;
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    sendError(res, 400, "Password must include at least 1 lowercase letter, 1 uppercase letter, and 1 number.");
    return;
  }

  try {
    const result = await verifySignup(email.toLowerCase().trim(), otp, password);
    sendSuccess(res, result);
  } catch (err) {
    handleControllerError(err, req, res, "Auth Verify", "An unexpected error occurred.");
  }
};

export const handleLogout: RequestHandler = async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const token = req.headers.authorization?.split(" ")[1];

  try {
    if (token) invalidateToken(token);
    await getSupabaseAdmin().auth.admin.signOut(userId);
    sendSuccess(res, { message: "Logged out successfully." });
  } catch (err) {
    handleControllerError(err, req, res, "Auth Logout", "Failed to log out.");
  }
};

export const handleResendOtp: RequestHandler = async (req, res) => {
  const { email } = req.body;

  if (!email || typeof email !== "string" || email.length > MAX_EMAIL_LEN || !EMAIL_RE.test(email)) {
    sendError(res, 400, "A valid email is required.");
    return;
  }

  try {
    const result = await resendOtp(email.toLowerCase().trim());
    sendSuccess(res, result);
  } catch (err) {
    handleControllerError(err, req, res, "Auth Resend", "An unexpected error occurred.");
  }
};

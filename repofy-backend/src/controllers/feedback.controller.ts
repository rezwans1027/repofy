import { RequestHandler } from "express";
import { getSupabaseAdmin } from "../config/supabase";
import { sendError, sendSuccess } from "../lib/response";
import { sendFeedbackNotificationEmail } from "../services/email.service";

const VALID_CATEGORIES = new Set(["bug", "feature", "feedback"]);

export const submitFeedback: RequestHandler = async (req, res) => {
  const userId = req.userId;
  const userEmail = req.userEmail;
  if (!userId) {
    sendError(res, 401, "Authentication required");
    return;
  }

  const { category, message } = req.body;

  if (!category || !VALID_CATEGORIES.has(category)) {
    sendError(res, 400, "Category must be one of: bug, feature, feedback");
    return;
  }

  if (typeof message !== "string" || message.trim().length < 10) {
    sendError(res, 400, "Message must be at least 10 characters");
    return;
  }

  if (message.length > 2000) {
    sendError(res, 400, "Message must be at most 2000 characters");
    return;
  }

  const trimmedMessage = message.trim();

  const { error } = await getSupabaseAdmin()
    .from("feedback")
    .insert({
      user_id: userId,
      category,
      message: trimmedMessage,
    });

  if (error) {
    sendError(res, 500, "Failed to submit feedback");
    return;
  }

  try {
    await sendFeedbackNotificationEmail({
      category,
      message: trimmedMessage,
      userId,
      userEmail,
      submittedAt: new Date().toISOString(),
    });
  } catch {
    // Best effort: the feedback was saved successfully, so do not fail the request.
  }

  sendSuccess(res, { submitted: true });
};

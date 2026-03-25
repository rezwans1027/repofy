import { env } from "../config/env";
import { getResend } from "../config/resend";
import { logger, maskEmail } from "../lib/logger";

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface FeedbackNotificationInput {
  category: string;
  message: string;
  userId: string;
  userEmail?: string;
  submittedAt: string;
}

export async function sendOtpEmail(
  email: string,
  otp: string,
  displayName: string,
): Promise<void> {
  const resend = getResend();

  const { error } = await resend.emails.send({
    from: "Repofy <noreply@repofy.app>",
    to: email,
    subject: "Your Repofy verification code",
    html: buildOtpHtml(otp, displayName),
  });

  if (error) {
    logger.error("Failed to send OTP email", { email: maskEmail(email), error });
    throw new Error("Failed to send verification email");
  }

  logger.info("OTP email sent", { email: maskEmail(email) });
}

export async function sendFeedbackNotificationEmail({
  category,
  message,
  userId,
  userEmail,
  submittedAt,
}: FeedbackNotificationInput): Promise<void> {
  const resend = getResend();

  const { error } = await resend.emails.send({
    from: "Repofy <noreply@repofy.app>",
    to: env.feedbackNotificationEmail,
    subject: buildFeedbackSubject(category, userEmail, userId),
    html: buildFeedbackHtml(category, message, userId, userEmail, submittedAt),
    ...(userEmail ? { replyTo: userEmail } : {}),
  });

  if (error) {
    logger.error("Failed to send feedback notification email", {
      recipientEmail: maskEmail(env.feedbackNotificationEmail),
      userEmail: userEmail ? maskEmail(userEmail) : undefined,
      userId,
      category,
      error,
    });
    throw new Error("Failed to send feedback notification email");
  }

  logger.info("Feedback notification email sent", {
    recipientEmail: maskEmail(env.feedbackNotificationEmail),
    userEmail: userEmail ? maskEmail(userEmail) : undefined,
    userId,
    category,
  });
}

function buildOtpHtml(otp: string, displayName: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#0A0A0B;font-family:'Inter',system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0B;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#111113;border-radius:12px;border:1px solid #222;">
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 4px;font-size:20px;font-weight:700;color:#22D3EE;font-family:'JetBrains Mono',monospace;letter-spacing:-0.5px;">
                repofy
              </p>
              <p style="margin:0 0 24px;font-size:13px;color:#888;font-family:monospace;">
                $ auth verify --email
              </p>

              <p style="margin:0 0 8px;font-size:15px;color:#e0e0e0;">
                Hey ${escapeHtml(displayName)},
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#e0e0e0;">
                Enter this code to verify your email and complete signup:
              </p>

              <div style="background:#0A0A0B;border:1px solid #333;border-radius:8px;padding:20px;text-align:center;margin:0 0 24px;">
                <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:#22D3EE;font-family:'JetBrains Mono',monospace;">
                  ${otp}
                </span>
              </div>

              <p style="margin:0 0 4px;font-size:13px;color:#888;">
                This code expires in 10 minutes.
              </p>
              <p style="margin:0;font-size:13px;color:#888;">
                If you didn't request this, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

function buildFeedbackSubject(category: string, userEmail: string | undefined, userId: string): string {
  const sender = userEmail || userId;
  return `[Repofy] New ${getFeedbackCategoryLabel(category)} from ${sender}`;
}

function formatMultilineHtml(str: string): string {
  return escapeHtml(str).replace(/\n/g, "<br />");
}

function getFeedbackCategoryLabel(category: string): string {
  switch (category) {
    case "bug":
      return "Bug Report";
    case "feature":
      return "Feature Request";
    case "feedback":
      return "General Feedback";
    default:
      return category;
  }
}

function buildFeedbackHtml(
  category: string,
  message: string,
  userId: string,
  userEmail: string | undefined,
  submittedAt: string,
): string {
  const categoryLabel = getFeedbackCategoryLabel(category);

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:24px;background:#f8fafc;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center">
        <table width="640" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;">
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 8px;font-size:20px;font-weight:700;color:#0f172a;">
                New ${escapeHtml(categoryLabel)}
              </p>
              <p style="margin:0 0 24px;font-size:14px;color:#475569;">
                A user submitted a ${escapeHtml(categoryLabel)} from the Repofy feedback page.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td style="padding:8px 0;font-size:14px;color:#475569;"><strong style="color:#0f172a;">Category:</strong> ${escapeHtml(categoryLabel)}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;font-size:14px;color:#475569;"><strong style="color:#0f172a;">User email:</strong> ${escapeHtml(userEmail || "Unavailable")}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;font-size:14px;color:#475569;"><strong style="color:#0f172a;">User ID:</strong> ${escapeHtml(userId)}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;font-size:14px;color:#475569;"><strong style="color:#0f172a;">Submitted at:</strong> ${escapeHtml(submittedAt)}</td>
                </tr>
              </table>

              <div style="padding:20px;background:#0f172a;border-radius:10px;">
                <p style="margin:0 0 12px;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#93c5fd;">
                  Message
                </p>
                <p style="margin:0;font-size:15px;line-height:1.65;color:#e2e8f0;">
                  ${formatMultilineHtml(message)}
                </p>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

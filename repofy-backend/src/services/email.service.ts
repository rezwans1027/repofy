import { getResend } from "../config/resend";
import { logger } from "../lib/logger";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
    logger.error("Failed to send OTP email", { email, error });
    throw new Error("Failed to send verification email");
  }

  logger.info("OTP email sent", { email });
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

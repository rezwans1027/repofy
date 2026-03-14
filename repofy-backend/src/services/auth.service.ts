import crypto from "crypto";
import { getSupabaseAdmin } from "../config/supabase";
import { sendOtpEmail } from "./email.service";
import { env } from "../config/env";
import { logger, maskEmail } from "../lib/logger";
import { expiresInMinutes } from "../lib/date-utils";

const OTP_EXPIRY_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;

export class AuthError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

function generateOtp(): string {
  return crypto.randomInt(100_000, 1_000_000).toString();
}

function hashOtp(otp: string): string {
  return crypto.createHmac("sha256", env.otpHmacSecret).update(otp).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

async function cleanupExpiredSignups(): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    await supabase
      .from("pending_signups")
      .delete()
      .lt("otp_expires_at", new Date().toISOString());
  } catch (err) {
    logger.warn("Failed to cleanup expired pending signups", { error: err });
  }
}

export async function initiateSignup(
  email: string,
  displayName: string,
): Promise<{ message: string }> {
  const supabase = getSupabaseAdmin();

  // Best-effort cleanup of expired rows (fire-and-forget to avoid blocking signup)
  cleanupExpiredSignups().catch((err) => {
    logger.warn("cleanupExpiredSignups failed", { error: err });
  });

  // Check if email already exists in auth.users (O(1) indexed lookup)
  const { data: emailTaken, error: rpcError } = await supabase.rpc("email_exists_in_auth", { p_email: email });
  if (rpcError) {
    logger.error("email_exists_in_auth RPC failed", { email: maskEmail(email), error: rpcError });
    throw new AuthError("Failed to initiate signup", 500);
  }

  if (emailTaken) {
    // Return the same success message to prevent account enumeration.
    // The existing user won't receive an OTP, so no action is taken.
    return { message: "A verification code has been sent to your email." };
  }

  const otp = generateOtp();
  const expiresAt = expiresInMinutes(OTP_EXPIRY_MINUTES);

  // Upsert — replaces any prior pending signup for the same email
  const { error: upsertError } = await supabase.from("pending_signups").upsert(
    {
      email,
      display_name: displayName,
      otp_code: hashOtp(otp),
      otp_expires_at: expiresAt,
      attempts: 0,
    },
    { onConflict: "email" },
  );

  if (upsertError) {
    logger.error("Failed to upsert pending signup", { email: maskEmail(email), error: upsertError });
    throw new AuthError("Failed to initiate signup", 500);
  }

  sendOtpEmail(email, otp, displayName).catch((err) => {
    logger.error("Failed to send OTP email during signup", { email: maskEmail(email), error: err });
  });

  return { message: "A verification code has been sent to your email." };
}

export async function verifySignup(
  email: string,
  otp: string,
  password: string,
): Promise<{ user: { id: string; email: string } }> {
  const UNIFIED_ERROR = "Invalid or expired verification code. Please try again.";
  const supabase = getSupabaseAdmin();

  // Atomic: increment attempts and return the row in one step.
  // Returns nothing if row is missing, expired, or attempts exhausted.
  const { data: rows, error: rpcError } = await supabase.rpc("increment_otp_attempt", {
    p_email: email,
    p_max_attempts: OTP_MAX_ATTEMPTS,
  });

  if (rpcError) {
    logger.error("increment_otp_attempt RPC failed", { email: maskEmail(email), error: rpcError });
    throw new AuthError("Failed to verify signup", 500);
  }

  const pending = Array.isArray(rows) ? rows[0] : null;

  if (!pending) {
    // No row returned → doesn't exist, expired, or locked out
    throw new AuthError(UNIFIED_ERROR, 400);
  }

  // Validate OTP (timing-safe comparison of SHA-256 hashes)
  if (!safeEqual(pending.otp_code, hashOtp(otp))) {
    // Attempt was already incremented by the RPC — just reject
    throw new AuthError(UNIFIED_ERROR, 400);
  }

  // Create the Supabase user with email already confirmed
  const { data: userData, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: pending.display_name },
  });

  if (createError) {
    logger.error("Failed to create user", { email: maskEmail(email), error: createError });
    if (createError.message?.includes("already been registered")) {
      throw new AuthError("An account with this email already exists.", 409);
    }
    throw new AuthError("Failed to create account. Please try again.", 500);
  }

  // Clean up pending signup
  await supabase.from("pending_signups").delete().eq("email", email);

  logger.info("User created via OTP signup", { email: maskEmail(email), userId: userData.user.id });

  return { user: { id: userData.user.id, email: userData.user.email ?? email } };
}

export async function resendOtp(email: string): Promise<{ message: string }> {
  const supabase = getSupabaseAdmin();

  const { data: pending, error } = await supabase
    .from("pending_signups")
    .select("email, display_name, attempts")
    .eq("email", email)
    .maybeSingle();

  if (error || !pending) {
    // Same generic message to prevent enumeration
    return { message: "If a pending signup exists, a new code has been sent." };
  }

  // Don't resend if the user has exhausted their OTP attempts — the new code
  // would be unusable since increment_otp_attempt rejects locked-out rows.
  if (pending.attempts >= OTP_MAX_ATTEMPTS) {
    return { message: "If a pending signup exists, a new code has been sent." };
  }

  const otp = generateOtp();
  const expiresAt = expiresInMinutes(OTP_EXPIRY_MINUTES);

  const { data: updated, error: updateError } = await supabase
    .from("pending_signups")
    .update({ otp_code: hashOtp(otp), otp_expires_at: expiresAt, attempts: 0 })
    .eq("email", email)
    .select("email")
    .maybeSingle();

  if (updateError || !updated) {
    logger.error("Failed to update OTP for resend", { email: maskEmail(email), error: updateError });
    throw new AuthError("Failed to resend code. Please try again.", 500);
  }

  sendOtpEmail(email, otp, pending.display_name).catch((err) => {
    logger.error("Failed to send OTP email during resend", { email: maskEmail(email), error: err });
  });

  return { message: "If a pending signup exists, a new code has been sent." };
}

import crypto from "crypto";
import { getSupabaseAdmin } from "../config/supabase";
import { sendOtpEmail } from "./email.service";
import { logger } from "../lib/logger";

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
  return crypto.randomInt(100_000, 999_999).toString();
}

function hashOtp(otp: string): string {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
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

  // Best-effort cleanup of expired rows
  await cleanupExpiredSignups();

  // Check if email already exists in auth.users (O(1) indexed lookup)
  const { data: emailTaken, error: rpcError } = await supabase.rpc("email_exists_in_auth", { p_email: email });
  if (rpcError) {
    logger.error("email_exists_in_auth RPC failed", { email, error: rpcError });
    throw new AuthError("Failed to initiate signup", 500);
  }

  if (!emailTaken) {
    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

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
      logger.error("Failed to upsert pending signup", { email, error: upsertError });
      throw new AuthError("Failed to initiate signup", 500);
    }

    await sendOtpEmail(email, otp, displayName);
  } else {
    // Burn roughly the same time as the happy path to prevent timing enumeration
    await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 50));
  }

  return { message: "If this email is available, a verification code has been sent." };
}

export async function verifySignup(
  email: string,
  otp: string,
  password: string,
): Promise<{ user: { id: string; email: string } }> {
  const supabase = getSupabaseAdmin();

  const { data: pending, error: fetchError } = await supabase
    .from("pending_signups")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  if (fetchError || !pending) {
    throw new AuthError("No pending signup found for this email. Please start over.", 400);
  }

  // Check expiry
  if (new Date(pending.otp_expires_at) < new Date()) {
    throw new AuthError("Verification code has expired. Please request a new one.", 400);
  }

  // Check attempts
  if (pending.attempts >= OTP_MAX_ATTEMPTS) {
    throw new AuthError("Too many failed attempts. Please request a new code.", 400);
  }

  // Validate OTP (timing-safe comparison of SHA-256 hashes)
  if (!safeEqual(pending.otp_code, hashOtp(otp))) {
    const newAttempts = pending.attempts + 1;
    await supabase
      .from("pending_signups")
      .update({ attempts: newAttempts })
      .eq("email", email);

    throw new AuthError("Invalid verification code. Please try again.", 400);
  }

  // Create the Supabase user with email already confirmed
  const { data: userData, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: pending.display_name },
  });

  if (createError) {
    logger.error("Failed to create user", { email, error: createError });
    // Handle duplicate email race condition
    if (createError.message?.includes("already been registered")) {
      throw new AuthError("An account with this email already exists.", 409);
    }
    throw new AuthError("Failed to create account. Please try again.", 500);
  }

  // Clean up pending signup
  await supabase.from("pending_signups").delete().eq("email", email);

  logger.info("User created via OTP signup", { email, userId: userData.user.id });

  return { user: { id: userData.user.id, email: userData.user.email! } };
}

export async function resendOtp(email: string): Promise<{ message: string }> {
  const supabase = getSupabaseAdmin();

  const { data: pending, error } = await supabase
    .from("pending_signups")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  if (error || !pending) {
    // Same generic message to prevent enumeration
    return { message: "If a pending signup exists, a new code has been sent." };
  }

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

  const { data: updated, error: updateError } = await supabase
    .from("pending_signups")
    .update({ otp_code: hashOtp(otp), otp_expires_at: expiresAt, attempts: 0 })
    .eq("email", email)
    .select("email")
    .maybeSingle();

  if (updateError || !updated) {
    logger.error("Failed to update OTP for resend", { email, error: updateError });
    throw new AuthError("Failed to resend code. Please try again.", 500);
  }

  await sendOtpEmail(email, otp, pending.display_name);

  return { message: "If a pending signup exists, a new code has been sent." };
}

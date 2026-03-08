"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { api, ApiError } from "@/lib/api-client";
import { TerminalWindow } from "@/components/ui/terminal-window";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from "@/components/ui/input-otp";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  Loader2,
  ArrowLeft,
} from "lucide-react";

type Phase = "form" | "otp" | "success";

export default function SignupPage() {
  const router = useRouter();

  // Phase 1 fields
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");

  // Phase 2 fields
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // UI state
  const [phase, setPhase] = useState<Phase>("form");
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Resend cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  // ── Phase 1: Initiate ──
  function validateForm() {
    const errs: Record<string, string> = {};
    if (!displayName.trim()) errs.displayName = "Display name is required";
    if (!email.trim()) {
      errs.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errs.email = "Enter a valid email address";
    }
    return errs;
  }

  async function handleInitiate(e: React.FormEvent) {
    e.preventDefault();
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});
    setIsLoading(true);

    try {
      await api.post("/auth/signup/initiate", {
        body: { email: email.trim(), displayName: displayName.trim() },
      });
      setPhase("otp");
      setCooldown(60);
    } catch (err) {
      setErrors({
        form: err instanceof ApiError ? err.message : "Something went wrong.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  // ── Phase 2: Verify ──
  function validateOtp() {
    const errs: Record<string, string> = {};
    if (!otp || otp.length !== 6) errs.otp = "Enter the 6-digit code";
    if (!password) {
      errs.password = "Password is required";
    } else if (password.length < 8) {
      errs.password = "Password must be at least 8 characters";
    } else if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      errs.password = "Must include lowercase, uppercase, and a number";
    }
    if (!confirmPassword) {
      errs.confirmPassword = "Please confirm your password";
    } else if (password !== confirmPassword) {
      errs.confirmPassword = "Passwords do not match";
    }
    return errs;
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    const validationErrors = validateOtp();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});
    setIsLoading(true);

    try {
      await api.post("/auth/signup/verify", {
        body: { email: email.trim(), otp, password },
      });

      // Auto sign-in after account creation
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        // Fallback — account created but auto-signin failed
        setPhase("success");
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      setErrors({
        form: err instanceof ApiError ? err.message : "Something went wrong.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  // ── Resend OTP ──
  const handleResend = useCallback(async () => {
    if (cooldown > 0) return;
    try {
      await api.post("/auth/signup/resend", {
        body: { email: email.trim() },
      });
      setCooldown(60);
    } catch {
      // Silently fail — don't reveal info
    }
  }, [cooldown, email]);

  // ── Render ──
  const terminalPrompt =
    phase === "otp"
      ? "$ repofy auth signup --verify"
      : "$ repofy auth signup";

  return (
    <div className="space-y-6">
      <Link
        href="/"
        className="text-cyan font-mono text-lg font-bold tracking-tight hover:opacity-80 transition-opacity inline-block"
      >
        repofy
      </Link>

      <TerminalWindow title="auth — signup">
        <div className="space-y-6">
          <div>
            <p className="font-mono text-sm text-muted-foreground">
              <span className="text-cyan">$</span>{" "}
              {terminalPrompt.replace("$ ", "")}
            </p>
          </div>

          {/* ── Phase: Success fallback ── */}
          {phase === "success" && (
            <div className="space-y-4">
              <p className="font-mono text-sm text-green-400">
                <span className="font-bold">success:</span> Account created
                successfully.
              </p>
              <p className="font-mono text-sm text-muted-foreground">
                You can now sign in with your email and password.
              </p>
              <Link
                href="/login"
                className="text-cyan font-mono text-sm hover:underline underline-offset-4 inline-block"
              >
                &larr; Go to login
              </Link>
            </div>
          )}

          {/* ── Phase 1: Email + Display Name ── */}
          {phase === "form" && (
            <form onSubmit={handleInitiate} noValidate className="space-y-4">
              <div className="space-y-2">
                <label
                  htmlFor="displayName"
                  className="font-mono text-xs text-muted-foreground"
                >
                  display name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    id="displayName"
                    type="text"
                    placeholder="Jane Doe"
                    value={displayName}
                    onChange={(e) => {
                      setDisplayName(e.target.value);
                      if (errors.displayName)
                        setErrors((p) => ({ ...p, displayName: undefined }));
                    }}
                    aria-invalid={!!errors.displayName}
                    className="pl-10 font-mono text-sm"
                  />
                </div>
                {errors.displayName && (
                  <p className="font-mono text-xs text-destructive">
                    <span className="font-bold">error:</span>{" "}
                    {errors.displayName}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="email"
                  className="font-mono text-xs text-muted-foreground"
                >
                  email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errors.email)
                        setErrors((p) => ({ ...p, email: undefined }));
                    }}
                    aria-invalid={!!errors.email}
                    className="pl-10 font-mono text-sm"
                  />
                </div>
                {errors.email && (
                  <p className="font-mono text-xs text-destructive">
                    <span className="font-bold">error:</span> {errors.email}
                  </p>
                )}
              </div>

              {errors.form && (
                <p className="font-mono text-sm text-destructive">
                  <span className="font-bold">error:</span> {errors.form}
                </p>
              )}

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-cyan text-background hover:bg-cyan/90 font-mono text-sm"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Sending code...
                  </>
                ) : (
                  "Continue"
                )}
              </Button>
            </form>
          )}

          {/* ── Phase 2: OTP + Password ── */}
          {phase === "otp" && (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => {
                  setPhase("form");
                  setOtp("");
                  setPassword("");
                  setConfirmPassword("");
                  setErrors({});
                }}
                className="flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="size-3" />
                Back
              </button>

              <p className="font-mono text-sm text-muted-foreground">
                Verification code sent to{" "}
                <span className="text-cyan">{email}</span>
              </p>

              <form onSubmit={handleVerify} noValidate className="space-y-4">
                <div className="space-y-2">
                  <label className="font-mono text-xs text-muted-foreground">
                    verification code
                  </label>
                  <div className="flex justify-center">
                    <InputOTP
                      maxLength={6}
                      value={otp}
                      onChange={(value) => {
                        setOtp(value);
                        if (errors.otp)
                          setErrors((p) => ({ ...p, otp: undefined }));
                      }}
                    >
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                      </InputOTPGroup>
                      <InputOTPSeparator />
                      <InputOTPGroup>
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  {errors.otp && (
                    <p className="font-mono text-xs text-destructive text-center">
                      <span className="font-bold">error:</span> {errors.otp}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="password"
                    className="font-mono text-xs text-muted-foreground"
                  >
                    password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (errors.password)
                          setErrors((p) => ({ ...p, password: undefined }));
                      }}
                      aria-invalid={!!errors.password}
                      className="pl-10 pr-10 font-mono text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="font-mono text-xs text-destructive">
                      <span className="font-bold">error:</span>{" "}
                      {errors.password}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="confirmPassword"
                    className="font-mono text-xs text-muted-foreground"
                  >
                    confirm password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (errors.confirmPassword)
                          setErrors((p) => ({
                            ...p,
                            confirmPassword: undefined,
                          }));
                      }}
                      aria-invalid={!!errors.confirmPassword}
                      className="pl-10 font-mono text-sm"
                    />
                  </div>
                  {errors.confirmPassword && (
                    <p className="font-mono text-xs text-destructive">
                      <span className="font-bold">error:</span>{" "}
                      {errors.confirmPassword}
                    </p>
                  )}
                </div>

                {errors.form && (
                  <p className="font-mono text-sm text-destructive">
                    <span className="font-bold">error:</span> {errors.form}
                  </p>
                )}

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-cyan text-background hover:bg-cyan/90 font-mono text-sm"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    "Create Account"
                  )}
                </Button>
              </form>

              <p className="text-center font-mono text-xs text-muted-foreground">
                Didn&apos;t receive a code?{" "}
                {cooldown > 0 ? (
                  <span className="text-muted-foreground/60">
                    Resend in {cooldown}s
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    className="text-cyan hover:underline underline-offset-4"
                  >
                    Resend code
                  </button>
                )}
              </p>
            </div>
          )}

          {phase === "form" && (
            <p className="text-center font-mono text-xs text-muted-foreground">
              Already have an account?{" "}
              <Link
                href="/login"
                className="text-cyan hover:underline underline-offset-4"
              >
                Sign in
              </Link>
            </p>
          )}
        </div>
      </TerminalWindow>
    </div>
  );
}

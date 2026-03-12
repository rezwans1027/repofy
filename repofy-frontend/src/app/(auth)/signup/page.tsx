"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { api, ApiError } from "@/lib/api-client";
import { useAuthTransition } from "../auth-transition";
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

const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

const phaseVariants = {
  enter: { opacity: 0, filter: "blur(6px)" },
  center: {
    opacity: 1,
    filter: "blur(0px)",
    transition: { duration: 0.35, ease: EASE_OUT_EXPO },
  },
  exit: {
    opacity: 0,
    filter: "blur(6px)",
    transition: { duration: 0.2 },
  },
};

export default function SignupPage() {
  const router = useRouter();
  const { navigateTo } = useAuthTransition();

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

  // ── Smooth height animation for phase transitions ──
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number | "auto">("auto");

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setContentHeight(el.scrollHeight);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Typewriter for --verify flag ──
  const [displayedFlag, setDisplayedFlag] = useState("");
  const [showFlagCursor, setShowFlagCursor] = useState(false);
  const verifyFlag = " --verify";

  useEffect(() => {
    if (phase === "otp" && displayedFlag !== verifyFlag) {
      setShowFlagCursor(true);
      let i = 0;
      const typeChar = () => {
        i++;
        setDisplayedFlag(verifyFlag.slice(0, i));
        if (i < verifyFlag.length) {
          setTimeout(typeChar, 60);
        } else {
          setTimeout(() => setShowFlagCursor(false), 300);
        }
      };
      typeChar();
    } else if (phase === "form" && displayedFlag !== "") {
      setShowFlagCursor(true);
      let text = displayedFlag;
      const backspace = () => {
        text = text.slice(0, -1);
        setDisplayedFlag(text);
        if (text.length > 0) {
          setTimeout(backspace, 40);
        } else {
          setTimeout(() => setShowFlagCursor(false), 300);
        }
      };
      backspace();
    }
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-sm text-muted-foreground">
          <span className="text-cyan">$</span> repofy auth signup{displayedFlag}
          {showFlagCursor && (
            <span className="ml-px text-cyan">▎</span>
          )}
        </p>
      </div>

      <motion.div
        className="overflow-hidden"
        animate={{ height: contentHeight }}
        initial={false}
        transition={{ duration: 0.35, ease: EASE_OUT_EXPO }}
      >
      <div ref={contentRef}>
      <AnimatePresence mode="wait">
        {/* ── Phase: Success fallback ── */}
        {phase === "success" && (
          <motion.div
            key="success"
            className="space-y-4"
            variants={phaseVariants}
            initial="enter"
            animate="center"
            exit="exit"
          >
            <p className="font-mono text-sm text-green-400">
              <span className="font-bold">success:</span> Account created
              successfully.
            </p>
            <p className="font-mono text-sm text-muted-foreground">
              You can now sign in with your email and password.
            </p>
            <button
              type="button"
              onClick={() => navigateTo("/login")}
              className="text-cyan font-mono text-sm hover:underline underline-offset-4"
            >
              &larr; Go to login
            </button>
          </motion.div>
        )}

        {/* ── Phase 1: Email + Display Name ── */}
        {phase === "form" && (
          <motion.div
            key="form"
            variants={phaseVariants}
            initial="enter"
            animate="center"
            exit="exit"
          >
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
                <motion.p
                  className="font-mono text-sm text-destructive"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <span className="font-bold">error:</span> {errors.form}
                </motion.p>
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
          </motion.div>
        )}

        {/* ── Phase 2: OTP + Password ── */}
        {phase === "otp" && (
          <motion.div
            key="otp"
            className="space-y-4"
            variants={phaseVariants}
            initial="enter"
            animate="center"
            exit="exit"
          >
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
                <motion.p
                  className="font-mono text-sm text-destructive"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <span className="font-bold">error:</span> {errors.form}
                </motion.p>
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
          </motion.div>
        )}
      </AnimatePresence>
      </div>
      </motion.div>

      <div className="relative h-5">
        <AnimatePresence initial={false}>
          {phase === "form" ? (
            <motion.p
              key="signin"
              className="absolute inset-0 text-center font-mono text-xs text-muted-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => navigateTo("/login")}
                className="text-cyan hover:underline underline-offset-4"
              >
                Sign in
              </button>
            </motion.p>
          ) : phase === "otp" ? (
            <motion.p
              key="resend"
              className="absolute inset-0 text-center font-mono text-xs text-muted-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
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
            </motion.p>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { api, ApiError } from "@/lib/api-client";
import { useAuth } from "@/components/providers/auth-provider";
import { useAuthTransition } from "../auth-transition";
import { useFlagTypewriter } from "@/hooks/use-flag-typewriter";
import { EASE_OUT_EXPO } from "@/lib/animation-variants";
import { FormPhase } from "./form-phase";
import { OtpPhase } from "./otp-phase";

type Phase = "form" | "otp" | "success";

const phaseVariants = {
  enter: { opacity: 0 },
  center: {
    opacity: 1,
    transition: { duration: 0.35, ease: EASE_OUT_EXPO },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.2 },
  },
};

export default function SignupPage() {
  const router = useRouter();
  const { refresh } = useAuth();
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

  // ── Typewriter for --verify flag ──
  const { text: displayedFlag, showCursor: showFlagCursor } = useFlagTypewriter(
    " --verify",
    phase === "otp",
  );

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

      // Backend sets cookies on verify — refresh auth context and redirect
      await refresh();
      router.push("/dashboard");
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
          <FormPhase
            displayName={displayName}
            email={email}
            errors={errors}
            isLoading={isLoading}
            onDisplayNameChange={(value) => {
              setDisplayName(value);
              if (errors.displayName)
                setErrors((p) => ({ ...p, displayName: undefined }));
            }}
            onEmailChange={(value) => {
              setEmail(value);
              if (errors.email)
                setErrors((p) => ({ ...p, email: undefined }));
            }}
            onSubmit={handleInitiate}
          />
        )}

        {/* ── Phase 2: OTP + Password ── */}
        {phase === "otp" && (
          <OtpPhase
            email={email}
            otp={otp}
            password={password}
            confirmPassword={confirmPassword}
            showPassword={showPassword}
            errors={errors}
            isLoading={isLoading}
            onOtpChange={(value) => {
              setOtp(value);
              if (errors.otp)
                setErrors((p) => ({ ...p, otp: undefined }));
            }}
            onPasswordChange={(value) => {
              setPassword(value);
              if (errors.password)
                setErrors((p) => ({ ...p, password: undefined }));
            }}
            onConfirmPasswordChange={(value) => {
              setConfirmPassword(value);
              if (errors.confirmPassword)
                setErrors((p) => ({ ...p, confirmPassword: undefined }));
            }}
            onTogglePassword={() => setShowPassword(!showPassword)}
            onBack={() => {
              setPhase("form");
              setOtp("");
              setPassword("");
              setConfirmPassword("");
              setErrors({});
            }}
            onSubmit={handleVerify}
          />
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

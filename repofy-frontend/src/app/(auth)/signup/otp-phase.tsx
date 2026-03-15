"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from "@/components/ui/input-otp";
import { Lock, Eye, EyeOff, Loader2, ArrowLeft } from "lucide-react";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const phaseVariants = {
  enter: { opacity: 0 },
  center: {
    opacity: 1,
    transition: { duration: 0.35, ease: EASE },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.2 },
  },
};

interface OtpPhaseProps {
  email: string;
  otp: string;
  password: string;
  confirmPassword: string;
  showPassword: boolean;
  errors: Record<string, string | undefined>;
  isLoading: boolean;
  onOtpChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onTogglePassword: () => void;
  onBack: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function OtpPhase({
  email,
  otp,
  password,
  confirmPassword,
  showPassword,
  errors,
  isLoading,
  onOtpChange,
  onPasswordChange,
  onConfirmPasswordChange,
  onTogglePassword,
  onBack,
  onSubmit,
}: OtpPhaseProps) {
  return (
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
        onClick={onBack}
        className="flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3" />
        Back
      </button>

      <p className="font-mono text-sm text-muted-foreground">
        Verification code sent to{" "}
        <span className="text-cyan">{email}</span>
      </p>

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <div className="space-y-2">
          <label className="font-mono text-xs text-muted-foreground">
            verification code
          </label>
          <div className="flex justify-center">
            <InputOTP
              maxLength={6}
              value={otp}
              onChange={onOtpChange}
              aria-describedby={errors.otp ? "otp-error" : undefined}
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
            <p id="otp-error" className="font-mono text-xs text-destructive text-center">
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
              onChange={(e) => onPasswordChange(e.target.value)}
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? "signup-password-error" : undefined}
              className="pl-10 pr-10 font-mono text-sm"
            />
            <button
              type="button"
              onClick={onTogglePassword}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </div>
          {errors.password && (
            <p id="signup-password-error" className="font-mono text-xs text-destructive">
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
              onChange={(e) => onConfirmPasswordChange(e.target.value)}
              aria-invalid={!!errors.confirmPassword}
              aria-describedby={errors.confirmPassword ? "confirmPassword-error" : undefined}
              className="pl-10 font-mono text-sm"
            />
          </div>
          {errors.confirmPassword && (
            <p id="confirmPassword-error" className="font-mono text-xs text-destructive">
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
  );
}

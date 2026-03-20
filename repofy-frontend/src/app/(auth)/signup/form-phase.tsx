"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, User, Loader2 } from "lucide-react";

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

interface FormPhaseProps {
  displayName: string;
  email: string;
  errors: Record<string, string | undefined>;
  isLoading: boolean;
  onDisplayNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function FormPhase({
  displayName,
  email,
  errors,
  isLoading,
  onDisplayNameChange,
  onEmailChange,
  onSubmit,
}: FormPhaseProps) {
  return (
    <motion.div
      key="form"
      variants={phaseVariants}
      initial="enter"
      animate="center"
      exit="exit"
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
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
              onChange={(e) => onDisplayNameChange(e.target.value)}
              aria-invalid={!!errors.displayName}
              aria-describedby={errors.displayName ? "displayName-error" : undefined}
              className="pl-10 font-mono text-sm"
            />
          </div>
          {errors.displayName && (
            <p id="displayName-error" className="font-mono text-xs text-destructive">
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
              onChange={(e) => onEmailChange(e.target.value)}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "signup-email-error" : undefined}
              className="pl-10 font-mono text-sm"
            />
          </div>
          {errors.email && (
            <p id="signup-email-error" className="font-mono text-xs text-destructive">
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
  );
}

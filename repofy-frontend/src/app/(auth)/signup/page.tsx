"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { TerminalWindow } from "@/components/ui/terminal-window";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, Lock, Eye, EyeOff, User, Loader2 } from "lucide-react";

export default function SignupPage() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{
    displayName?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
    form?: string;
  }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  function validate() {
    const newErrors: typeof errors = {};
    if (!displayName.trim()) {
      newErrors.displayName = "Display name is required";
    }
    if (!email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Enter a valid email address";
    }
    if (!password) {
      newErrors.password = "Password is required";
    } else if (password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }
    if (!confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }
    return newErrors;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});
    setIsLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
        },
      },
    });

    if (error) {
      setErrors({ form: error.message });
      setIsLoading(false);
      return;
    }

    setIsSuccess(true);
    setIsLoading(false);
  }

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
              <span className="text-cyan">$</span> repofy auth signup
            </p>
          </div>

          {isSuccess ? (
            <div className="space-y-4">
              <p className="font-mono text-sm text-green-400">
                <span className="font-bold">success:</span> Account created
                successfully.
              </p>
              <p className="font-mono text-sm text-muted-foreground">
                Check your email for a confirmation link to activate your
                account.
              </p>
              <Link
                href="/login"
                className="text-cyan font-mono text-sm hover:underline underline-offset-4 inline-block"
              >
                &larr; Back to login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="displayName" className="font-mono text-xs text-muted-foreground">
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
                      if (errors.displayName) setErrors((prev) => ({ ...prev, displayName: undefined }));
                    }}
                    aria-invalid={!!errors.displayName}
                    className="pl-10 font-mono text-sm"
                  />
                </div>
                {errors.displayName && (
                  <p className="font-mono text-xs text-destructive">
                    <span className="font-bold">error:</span> {errors.displayName}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="email" className="font-mono text-xs text-muted-foreground">
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
                      if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
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

              <div className="space-y-2">
                <label htmlFor="password" className="font-mono text-xs text-muted-foreground">
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
                      if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
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
                    <span className="font-bold">error:</span> {errors.password}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="confirmPassword" className="font-mono text-xs text-muted-foreground">
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
                      if (errors.confirmPassword) setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                    }}
                    aria-invalid={!!errors.confirmPassword}
                    className="pl-10 font-mono text-sm"
                  />
                </div>
                {errors.confirmPassword && (
                  <p className="font-mono text-xs text-destructive">
                    <span className="font-bold">error:</span> {errors.confirmPassword}
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
                    Creating account...
                  </>
                ) : (
                  "Create Account"
                )}
              </Button>
            </form>
          )}

          {!isSuccess && (
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

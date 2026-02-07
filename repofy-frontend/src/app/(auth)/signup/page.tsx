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
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

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
      setError(error.message);
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
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="font-mono text-xs text-muted-foreground">
                  display name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Jane Doe"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="pl-10 font-mono text-sm"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="font-mono text-xs text-muted-foreground">
                  email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 font-mono text-sm"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="font-mono text-xs text-muted-foreground">
                  password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 font-mono text-sm"
                    required
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
              </div>

              <div className="space-y-2">
                <label className="font-mono text-xs text-muted-foreground">
                  confirm password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10 font-mono text-sm"
                    required
                  />
                </div>
              </div>

              {error && (
                <p className="font-mono text-sm text-destructive">
                  <span className="text-destructive font-bold">error:</span>{" "}
                  {error}
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

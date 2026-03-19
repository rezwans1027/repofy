"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { api, ApiError } from "@/lib/api-client";
import { useAuth } from "@/components/providers/auth-provider";
import { useAuthTransition } from "../auth-transition";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, Lock, Eye, EyeOff, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const { navigateTo } = useAuthTransition();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [isLoading, setIsLoading] = useState(false);

  function validate() {
    const newErrors: typeof errors = {};
    if (!email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Enter a valid email address";
    }
    if (!password) {
      newErrors.password = "Password is required";
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

    try {
      await api.post("/auth/login", { body: { email, password } });
      await refresh();
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setErrors({ form: err instanceof ApiError ? err.message : "Something went wrong." });
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-sm text-muted-foreground">
          <span className="text-cyan">$</span> repofy auth login
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
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
              aria-describedby={errors.email ? "email-error" : undefined}
              className="pl-10 font-mono text-sm"
            />
          </div>
          {errors.email && (
            <p id="email-error" className="font-mono text-xs text-destructive">
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
              aria-describedby={errors.password ? "password-error" : undefined}
              className="pl-10 pr-10 font-mono text-sm"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {errors.password && (
            <p id="password-error" className="font-mono text-xs text-destructive">
              <span className="font-bold">error:</span> {errors.password}
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
              Authenticating...
            </>
          ) : (
            "Sign In"
          )}
        </Button>
      </form>

      <p className="text-center font-mono text-xs text-muted-foreground">
        Don&apos;t have an account?{" "}
        <button
          type="button"
          onClick={() => navigateTo("/signup")}
          className="text-cyan hover:underline underline-offset-4"
        >
          Sign up
        </button>
      </p>
    </div>
  );
}

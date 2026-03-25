"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { getSupabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Github, Loader2, Lock } from "lucide-react";
import {
  EASE_OUT_EXPO,
  staggerContainer,
  staggerItem,
} from "@/lib/animation-variants";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageContent />
    </Suspense>
  );
}

const ERROR_MESSAGES: Record<string, string> = {
  missing_code: "Authentication failed. Please try again.",
  exchange_failed: "Could not complete sign-in. Please try again.",
  no_provider_token: "GitHub did not grant the required permissions. Please try again.",
  backend_error: "Something went wrong on our end. Please try again.",
  backend_unreachable: "Our servers are temporarily unavailable. Please try again shortly.",
};

function LoginPageContent() {
  const searchParams = useSearchParams();
  const callbackError = searchParams.get("error");
  const [error, setError] = useState<string | null>(
    callbackError ? (ERROR_MESSAGES[callbackError] ?? "Something went wrong. Please try again.") : null,
  );
  const [isLoading, setIsLoading] = useState(false);

  async function handleGitHubLogin() {
    setError(null);
    setIsLoading(true);

    try {
      const { error: oauthError } = await getSupabase().auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo: `${window.location.origin}/callback`,
          scopes: "read:user user:email",
        },
      });

      if (oauthError) {
        setError(oauthError.message);
        setIsLoading(false);
      }
      // If no error, the browser will redirect to GitHub
    } catch {
      setError("Something went wrong. Please try again.");
      setIsLoading(false);
    }
  }

  return (
    <motion.div
      className="space-y-6"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      {/* Status indicators */}
      <motion.div variants={staggerItem} className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground/70">
            system ready
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Lock className="size-3 text-muted-foreground/40" />
          <span className="font-mono text-[11px] text-muted-foreground/40">
            tls 1.3 · oauth 2.0
          </span>
        </div>
      </motion.div>

      {/* Terminal command */}
      <motion.div variants={staggerItem}>
        <p className="font-mono text-sm text-muted-foreground">
          <span className="text-cyan">$</span> repofy auth login
          <span className="ml-0.5 text-cyan animate-blink">_</span>
        </p>
      </motion.div>

      {/* Gradient divider */}
      <motion.div
        variants={staggerItem}
        className="h-px bg-gradient-to-r from-transparent via-border to-transparent"
      />

      {error && (
        <motion.p
          role="alert"
          id="login-error"
          className="font-mono text-sm text-destructive"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <span className="font-bold">error:</span> {error}
        </motion.p>
      )}

      <motion.div variants={staggerItem}>
        <Button
          onClick={handleGitHubLogin}
          disabled={isLoading}
          aria-describedby={error ? "login-error" : undefined}
          className="w-full bg-cyan text-background hover:bg-cyan/70 font-mono text-sm"
        >
          {isLoading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <Github className="size-4" />
              Continue with GitHub
            </>
          )}
        </Button>
      </motion.div>

      <motion.p
        variants={staggerItem}
        className="text-center text-[11px] leading-relaxed text-muted-foreground/60"
      >
        We use your GitHub token to fetch public profile data for analysis. It
        is stored securely and never shared.
      </motion.p>
    </motion.div>
  );
}

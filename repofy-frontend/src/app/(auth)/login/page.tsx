"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { getSupabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Github, Loader2 } from "lucide-react";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const callbackError = searchParams.get("error");
  const [error, setError] = useState<string | null>(callbackError);
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
    <div className="space-y-6">
      <div>
        <p className="font-mono text-sm text-muted-foreground">
          <span className="text-cyan">$</span> repofy auth login
        </p>
      </div>

      {error && (
        <motion.p
          className="font-mono text-sm text-destructive"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <span className="font-bold">error:</span> {error}
        </motion.p>
      )}

      <Button
        onClick={handleGitHubLogin}
        disabled={isLoading}
        className="w-full bg-cyan text-background hover:bg-cyan/90 font-mono text-sm"
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

      <p className="text-center text-[11px] leading-relaxed text-muted-foreground/60">
        We use your GitHub token to fetch public profile data for analysis. It is stored securely and never shared.
      </p>
    </div>
  );
}

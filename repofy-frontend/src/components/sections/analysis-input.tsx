"use client";

import { TYPEWRITER_USERNAMES } from "@/lib/constants";
import { useTypewriter } from "@/hooks/use-typewriter";

export function AnalysisInput() {
  const placeholder = useTypewriter(TYPEWRITER_USERNAMES);

  return (
    <section
      id="analysis-input"
      className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center py-20"
    >
      <div className="w-full max-w-2xl">
        <p className="text-muted-foreground mb-6 text-center font-mono text-sm">
          Paste any GitHub username. See what we see.
        </p>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3">
          <span className="text-cyan font-mono text-sm font-bold shrink-0">
            $ repofy analyze
          </span>
          <input
            type="text"
            disabled
            placeholder={placeholder}
            className="flex-1 bg-transparent font-mono text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none cursor-default"
          />
          <span className="text-cyan animate-blink font-mono">_</span>
        </div>

        <p className="text-muted-foreground mt-8 text-center text-xs">
          We read the code. All of it.
        </p>
      </div>
    </section>
  );
}

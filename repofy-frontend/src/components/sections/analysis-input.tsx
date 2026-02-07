"use client";

import { useState, useEffect, useCallback } from "react";
import { TYPEWRITER_USERNAMES } from "@/lib/constants";
import { useAnalysis } from "@/components/providers/analysis-provider";

export function AnalysisInput() {
  const [placeholder, setPlaceholder] = useState("");
  const [usernameIndex, setUsernameIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const { startAnalysis, state } = useAnalysis();

  // Typewriter effect for placeholder
  useEffect(() => {
    const currentName = TYPEWRITER_USERNAMES[usernameIndex];

    const timeout = setTimeout(
      () => {
        if (!isDeleting) {
          setPlaceholder(currentName.slice(0, charIndex + 1));
          setCharIndex((c) => c + 1);

          if (charIndex + 1 === currentName.length) {
            setTimeout(() => setIsDeleting(true), 1500);
          }
        } else {
          setPlaceholder(currentName.slice(0, charIndex - 1));
          setCharIndex((c) => c - 1);

          if (charIndex <= 1) {
            setIsDeleting(false);
            setUsernameIndex((i) => (i + 1) % TYPEWRITER_USERNAMES.length);
            setCharIndex(0);
          }
        }
      },
      isDeleting ? 50 : 120
    );

    return () => clearTimeout(timeout);
  }, [charIndex, isDeleting, usernameIndex]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (inputValue.trim()) {
        startAnalysis(inputValue.trim());
      }
    },
    [inputValue, startAnalysis]
  );

  return (
    <section
      id="analysis-input"
      className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center py-20"
    >
      <div className="w-full max-w-2xl">
        <p className="text-muted-foreground mb-6 text-center font-mono text-sm">
          Paste any GitHub username. See what we see.
        </p>
        <form onSubmit={handleSubmit}>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 transition-colors focus-within:border-cyan">
            <span className="text-cyan font-mono text-sm font-bold shrink-0">
              $ repofy analyze
            </span>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={placeholder}
              className="flex-1 bg-transparent font-mono text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
              autoFocus
            />
            <span className="text-cyan animate-blink font-mono">_</span>
          </div>
        </form>

        {state.isAnalyzing && (
          <div className="mt-6 text-center">
            <p className="text-cyan font-mono text-sm animate-pulse">
              Analyzing {state.username}...
            </p>
          </div>
        )}

        <p className="text-muted-foreground mt-8 text-center text-xs">
          We read the code. All of it.
        </p>
      </div>
    </section>
  );
}

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { TYPEWRITER_USERNAMES } from "@/lib/constants";
import { ArrowRight } from "lucide-react";

export function Hero() {
  const [placeholder, setPlaceholder] = useState("");
  const [usernameIndex, setUsernameIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

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

  return (
    <section
      id="hero"
      className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center py-20"
    >
      <div className="w-full max-w-3xl text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="text-cyan mb-4 font-mono text-sm tracking-wide">
            AI-powered GitHub analysis for technical hiring
          </p>
          <h1 className="font-mono text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            Know any developer.
            <br />
            <span className="text-cyan">From their code.</span>
          </h1>
          <p className="text-muted-foreground mx-auto mt-6 max-w-xl text-base sm:text-lg">
            Paste a GitHub username. Get a hiring-grade evaluation, actionable career
            advice, or a side-by-side candidate comparison — powered by AI.
          </p>
        </motion.div>

        {/* Terminal input */}
        <motion.div
          className="mx-auto mt-10 max-w-xl"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3">
            <span className="text-cyan shrink-0 font-mono text-sm font-bold">
              $ repofy analyze
            </span>
            <input
              type="text"
              disabled
              placeholder={placeholder}
              className="flex-1 cursor-default bg-transparent font-mono text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
            />
            <span className="text-cyan animate-blink font-mono">_</span>
          </div>
        </motion.div>

        {/* CTAs */}
        <motion.div
          className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <Button
            size="lg"
            className="bg-cyan text-background hover:bg-cyan/90 font-mono text-sm"
            asChild
          >
            <Link href="/login">
              Get Started Free
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="font-mono text-sm"
            onClick={() =>
              document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })
            }
          >
            See How It Works
          </Button>
        </motion.div>

        {/* Trust line */}
        <motion.p
          className="text-muted-foreground mt-12 font-mono text-xs"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          Free during beta &middot; No credit card required
        </motion.p>
      </div>
    </section>
  );
}

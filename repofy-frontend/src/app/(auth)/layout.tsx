"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { EASE_OUT_EXPO } from "@/lib/animation-variants";

const SUFFIX_MAP: Record<string, string> = {
  "/login": "login",
  "/callback": "callback",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const suffix = useMemo(() => SUFFIX_MAP[pathname] ?? "", [pathname]);

  return (
    <main id="main-content" className="relative flex min-h-screen items-start justify-center px-4 pt-[25vh] overflow-hidden">
      {/* ── Background atmosphere ──────────────────────────────── */}
      <div className="auth-grid-bg" />

      <motion.div
        className="relative z-10 w-full max-w-md space-y-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE_OUT_EXPO }}
      >
        <Link
          href="/"
          className="text-cyan font-mono text-lg font-bold tracking-tight hover:opacity-80 transition-opacity inline-block"
        >
          repofy
        </Link>

        <div className="relative">
          <div className="overflow-hidden rounded-lg border border-border bg-card/80 backdrop-blur-sm shadow-2xl shadow-black/20">
            {/* Title bar */}
            <div className="flex items-center border-b border-border px-4 py-3">
              <span className="font-mono text-xs text-muted-foreground">
                auth — {suffix}
              </span>
            </div>

            {/* Content */}
            <div className="p-4">{children}</div>
          </div>
        </div>

        {/* Ambient gradient line */}
        <motion.div
          className="mx-auto h-px w-2/3 bg-gradient-to-r from-transparent via-cyan/15 to-transparent"
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ duration: 1, delay: 0.7, ease: EASE_OUT_EXPO }}
        />
      </motion.div>
    </main>
  );
}

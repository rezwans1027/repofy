"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { AuthTransitionContext } from "./auth-transition";

const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

const SUFFIX_MAP: Record<string, string> = {
  "/login": "login",
  "/signup": "signup",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [suffix, setSuffix] = useState(SUFFIX_MAP[pathname] ?? "");
  const [contentVisible, setContentVisible] = useState(true);
  const [showCursor, setShowCursor] = useState(false);
  const animatingRef = useRef(false);

  // Sync suffix if pathname changes externally (browser back/forward)
  useEffect(() => {
    if (!animatingRef.current) {
      setSuffix(SUFFIX_MAP[pathname] ?? "");
    }
  }, [pathname]);

  const navigateTo = useCallback(
    (path: string) => {
      if (animatingRef.current || path === pathname) return;
      animatingRef.current = true;

      const oldSuffix = SUFFIX_MAP[pathname] ?? "";
      const newSuffix = SUFFIX_MAP[path] ?? "";

      // Collapse content and start backspace simultaneously
      setShowCursor(true);
      setContentVisible(false);

      let text = oldSuffix;
      const backspace = () => {
        if (text.length === 0) {
          // Navigate while collapsed, then type + expand together
          router.push(path);

          setTimeout(() => {
            setContentVisible(true);
            let i = 0;
            const typeChar = () => {
              i++;
              setSuffix(newSuffix.slice(0, i));
              if (i < newSuffix.length) {
                setTimeout(typeChar, 70);
              } else {
                setTimeout(() => {
                  setShowCursor(false);
                  animatingRef.current = false;
                }, 400);
              }
            };
            typeChar();
          }, 150);
        } else {
          text = text.slice(0, -1);
          setSuffix(text);
          setTimeout(backspace, 60);
        }
      };

      backspace();
    },
    [pathname, router]
  );

  return (
    <AuthTransitionContext.Provider value={{ navigateTo }}>
      <div className="relative flex min-h-screen items-start justify-center px-4 pt-[25vh] overflow-hidden">
        <motion.div
          className="relative z-10 w-full max-w-md space-y-6"
          initial={{ opacity: 0, y: 20, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.6, ease: EASE_OUT_EXPO }}
        >
          <Link
            href="/"
            className="text-cyan font-mono text-lg font-bold tracking-tight hover:opacity-80 transition-opacity inline-block"
          >
            repofy
          </Link>

          <div className="overflow-hidden rounded-lg border border-border bg-card">
            {/* Title bar */}
            <div className="flex items-center border-b border-border px-4 py-3">
              <span className="font-mono text-xs text-muted-foreground">
                auth — {suffix}
                {showCursor && (
                  <span className="animate-smooth-caret-blink ml-px text-cyan">
                    ▎
                  </span>
                )}
              </span>
            </div>

            {/* Collapsible content */}
            <motion.div
              className="overflow-hidden"
              animate={{
                height: contentVisible ? "auto" : 0,
                opacity: contentVisible ? 1 : 0,
              }}
              initial={false}
              transition={{
                height: { duration: 0.35, ease: EASE_OUT_EXPO },
                opacity: {
                  duration: contentVisible ? 0.3 : 0.2,
                  delay: contentVisible ? 0.08 : 0,
                },
              }}
            >
              <div className="p-4">{children}</div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </AuthTransitionContext.Provider>
  );
}

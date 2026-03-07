"use client";

import { motion } from "framer-motion";
import { AnimateOnView } from "@/components/ui/animate-on-view";
import { Badge } from "@/components/ui/badge";
import { EASE_OUT_EXPO } from "@/lib/animation-variants";

interface AdviceTopBannerProps {
  username: string;
  avatarUrl?: string;
}

export function AdviceTopBanner({ username, avatarUrl }: AdviceTopBannerProps) {
  return (
    <AnimateOnView delay={0}>
      <div className="rounded-lg border border-border bg-card p-5 overflow-hidden">
        <div className="flex items-center gap-4">
          {/* Avatar with glow ring */}
          <motion.div
            className="relative"
            initial={{ scale: 0.7, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true }}
            transition={{
              type: "spring",
              stiffness: 200,
              damping: 20,
              delay: 0.15,
            }}
          >
            {/* Animated glow ring */}
            <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-emerald-400/25 via-cyan/20 to-emerald-400/25 animate-glow-pulse blur-[3px]" />

            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={username}
                className="relative h-16 w-16 rounded-full border-2 border-emerald-400/40"
              />
            ) : (
              <div className="relative flex h-16 w-16 items-center justify-center rounded-full border-2 border-emerald-400/40 bg-secondary font-mono text-xl font-bold text-emerald-400">
                {username.charAt(0).toUpperCase()}
              </div>
            )}
          </motion.div>

          <div>
            <motion.h1
              initial={{ opacity: 0, x: -16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.25, ease: EASE_OUT_EXPO }}
              className="font-mono text-lg font-bold tracking-tight"
            >
              @{username}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.35, ease: EASE_OUT_EXPO }}
              className="font-mono text-sm text-muted-foreground"
            >
              Profile Advisor
            </motion.p>
            <motion.div
              className="mt-1.5"
              initial={{ opacity: 0, scale: 0.92 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, ease: EASE_OUT_EXPO, delay: 0.45 }}
            >
              <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px]">
                Actionable Advice
              </Badge>
            </motion.div>
          </div>
        </div>
      </div>
    </AnimateOnView>
  );
}

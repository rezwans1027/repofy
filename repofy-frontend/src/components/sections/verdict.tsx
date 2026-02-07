"use client";

import { verdict } from "@/lib/demo-data";
import { SectionHeader } from "@/components/ui/section-header";
import { AnimateOnView } from "@/components/ui/animate-on-view";
import { CountUp } from "@/components/ui/count-up";
import { MetricBar } from "@/components/ui/metric-bar";
import { motion } from "framer-motion";

export function Verdict() {
  return (
    <section id="verdict" className="py-20">
      <AnimateOnView>
        <SectionHeader
          title="The Verdict"
          subtitle="One page. No guesswork."
        />
      </AnimateOnView>

      <div className="grid gap-6 md:grid-cols-[auto_1fr]">
        {/* Grade */}
        <AnimateOnView delay={0.1}>
          <div className="flex items-center justify-center rounded-lg border border-border bg-card p-8">
            <motion.div
              className="text-center"
              initial={{ scale: 0.5, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              <span className="text-cyan font-mono text-7xl font-bold">
                {verdict.grade}
              </span>
              <p className="text-muted-foreground mt-2 font-mono text-xs">
                Overall Grade
              </p>
            </motion.div>
          </div>
        </AnimateOnView>

        {/* Summary + scores */}
        <AnimateOnView delay={0.2}>
          <div className="rounded-lg border border-border bg-card p-6">
            <p className="text-foreground text-sm leading-relaxed">
              {verdict.summary}
            </p>

            <div className="mt-6 space-y-4">
              {verdict.scores.map((score) => (
                <div key={score.label} className="flex items-center gap-4">
                  <MetricBar
                    label={score.label}
                    value={score.value}
                    className="flex-1"
                  />
                  <CountUp
                    end={score.value}
                    suffix="%"
                    className="text-cyan w-12 text-right text-sm"
                  />
                </div>
              ))}
            </div>
          </div>
        </AnimateOnView>
      </div>
    </section>
  );
}

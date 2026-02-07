"use client";

import { languages } from "@/lib/demo-data";
import { SectionHeader } from "@/components/ui/section-header";
import { AnimateOnView } from "@/components/ui/animate-on-view";
import { motion } from "framer-motion";

export function LanguageFingerprint() {
  return (
    <section id="language-fingerprint" className="py-20">
      <AnimateOnView>
        <SectionHeader
          title="Language Fingerprint"
          subtitle='Language !== skill. But patterns don&apos;t lie.'
        />
      </AnimateOnView>

      {/* Stacked bar overview */}
      <AnimateOnView delay={0.1}>
        <div className="mb-8 flex h-4 overflow-hidden rounded-full">
          {languages.map((lang) => (
            <motion.div
              key={lang.name}
              className="h-full first:rounded-l-full last:rounded-r-full"
              style={{ backgroundColor: lang.color }}
              initial={{ width: 0 }}
              whileInView={{ width: `${lang.percentage}%` }}
              viewport={{ once: true }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          ))}
        </div>
      </AnimateOnView>

      {/* Language details */}
      <div className="space-y-3">
        {languages.map((lang, i) => (
          <AnimateOnView key={lang.name} delay={0.05 * i}>
            <div className="flex items-center gap-4 rounded-lg border border-border bg-card px-4 py-3">
              <div
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: lang.color }}
              />
              <span className="w-24 font-mono text-sm font-medium">
                {lang.name}
              </span>

              {/* Bar */}
              <div className="flex-1">
                <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: lang.color }}
                    initial={{ width: 0 }}
                    whileInView={{ width: `${lang.confidence * 100}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                  />
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-4 font-mono text-xs text-muted-foreground">
                <span>{lang.loc.toLocaleString()} LOC</span>
                <span>{lang.repos} repos</span>
                <span className="text-foreground">
                  {Math.round(lang.confidence * 100)}%
                </span>
              </div>
            </div>
          </AnimateOnView>
        ))}
      </div>
    </section>
  );
}

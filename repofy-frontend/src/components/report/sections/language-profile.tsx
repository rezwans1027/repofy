"use client";

import { motion } from "framer-motion";
import { AnimateOnView } from "@/components/ui/animate-on-view";
import { SectionHeader } from "@/components/ui/section-header";
import type { ReportData } from "@/components/report/analysis-report";

interface LanguageProfileProps {
  languageProfile: ReportData["languageProfile"];
}

export function LanguageProfile({ languageProfile }: LanguageProfileProps) {
  const langs = languageProfile.languages;

  return (
    <AnimateOnView delay={0.3}>
      <div className="rounded-lg border border-border bg-card p-5">
        <SectionHeader title="Language Profile" />
        <div className="flex h-5 w-full overflow-hidden rounded-full">
          {langs.map((lang) => (
            <motion.div
              key={lang.name}
              className="h-full"
              style={{ backgroundColor: lang.color }}
              initial={{ width: 0 }}
              whileInView={{ width: `${lang.percentage}%` }}
              viewport={{ once: true }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          ))}
        </div>
        <div className="mt-4 space-y-2">
          {langs.map((lang) => (
            <div key={lang.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: lang.color }}
                />
                <span className="font-mono text-xs">{lang.name}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-mono text-[10px] text-muted-foreground">
                  {lang.repos} repos
                </span>
                <span className="font-mono text-xs text-cyan w-8 text-right">
                  {lang.percentage}%
                </span>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          {languageProfile.interpretation}
        </p>
      </div>
    </AnimateOnView>
  );
}

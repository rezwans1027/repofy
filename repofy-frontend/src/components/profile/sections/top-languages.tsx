"use client";

import { motion } from "framer-motion";
import { AnimateOnView } from "@/components/ui/animate-on-view";
import { SectionHeader } from "@/components/ui/section-header";

interface Language {
  name: string;
  color: string;
  percentage: number;
  repoCount?: number;
}

interface TopLanguagesProps {
  languages: Language[];
}

export function TopLanguages({ languages }: TopLanguagesProps) {
  return (
    <AnimateOnView delay={0.12}>
      <SectionHeader title="Top Languages" />
      <div className="space-y-2">
        <div className="h-3 overflow-hidden rounded-full">
          <motion.div
            className="flex h-full origin-left"
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            {languages.map((lang) => (
              <div
                key={lang.name}
                className="h-full"
                style={{
                  backgroundColor: lang.color,
                  width: `${lang.percentage}%`,
                }}
              />
            ))}
          </motion.div>
        </div>
        <div className="flex flex-wrap gap-3">
          {languages.map((lang) => (
            <div key={lang.name} className="flex items-center gap-1.5">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: lang.color }}
              />
              <span className="font-mono text-xs text-muted-foreground">
                {lang.name}{" "}
                <span className="text-foreground">{lang.percentage}%</span>
                {lang.repoCount != null && (
                  <span className="text-muted-foreground/60"> ({lang.repoCount})</span>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
    </AnimateOnView>
  );
}

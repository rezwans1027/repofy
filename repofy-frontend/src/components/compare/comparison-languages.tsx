"use client";

import { motion } from "framer-motion";
import { SectionHeader } from "@/components/ui/section-header";
import type { ReportData } from "@/components/report/analysis-report";

interface ComparisonLanguagesProps {
  reportA: ReportData;
  reportB: ReportData;
  usernameA: string;
  usernameB: string;
}

function LanguageBar({
  languages,
  username,
  accentColor,
}: {
  languages: ReportData["languageProfile"]["languages"];
  username: string;
  accentColor: string;
}) {
  return (
    <div className="space-y-1.5">
      <p className="font-mono text-xs" style={{ color: accentColor }}>
        @{username}
      </p>
      <div className="flex h-4 w-full overflow-hidden rounded-full">
        {languages.map((lang) => (
          <motion.div
            key={lang.name}
            className="h-full"
            style={{ backgroundColor: lang.color }}
            initial={{ width: 0 }}
            animate={{ width: `${lang.percentage}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        ))}
      </div>
    </div>
  );
}

export function ComparisonLanguages({
  reportA,
  reportB,
  usernameA,
  usernameB,
}: ComparisonLanguagesProps) {
  const langsA = reportA.languageProfile.languages;
  const langsB = reportB.languageProfile.languages;

  // Build merged table: union of all languages sorted by max percentage
  const langMap = new Map<string, { color: string; pctA: number; pctB: number; reposA: number; reposB: number }>();

  for (const lang of langsA) {
    langMap.set(lang.name, { color: lang.color, pctA: lang.percentage, pctB: 0, reposA: lang.repos, reposB: 0 });
  }
  for (const lang of langsB) {
    const existing = langMap.get(lang.name);
    if (existing) {
      existing.pctB = lang.percentage;
      existing.reposB = lang.repos;
    } else {
      langMap.set(lang.name, { color: lang.color, pctA: 0, pctB: lang.percentage, reposA: 0, reposB: lang.repos });
    }
  }

  const merged = Array.from(langMap.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => Math.max(b.pctA, b.pctB) - Math.max(a.pctA, a.pctB));

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <SectionHeader title="Language Profile" />

      <div className="space-y-4">
        <LanguageBar languages={langsA} username={usernameA} accentColor="#22D3EE" />
        <LanguageBar languages={langsB} username={usernameB} accentColor="#A78BFA" />
      </div>

      {/* Merged table */}
      <div className="mt-5 overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="pb-2 text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Language
              </th>
              <th className="pb-2 text-right font-mono text-[10px] uppercase tracking-wider text-cyan">
                A %
              </th>
              <th className="pb-2 text-right font-mono text-[10px] uppercase tracking-wider text-violet-400">
                B %
              </th>
              <th className="pb-2 text-right font-mono text-[10px] uppercase tracking-wider text-cyan">
                A Repos
              </th>
              <th className="pb-2 text-right font-mono text-[10px] uppercase tracking-wider text-violet-400">
                B Repos
              </th>
            </tr>
          </thead>
          <tbody>
            {merged.map((lang) => (
              <tr key={lang.name} className="border-b border-border last:border-0">
                <td className="py-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: lang.color }}
                    />
                    <span className="font-mono text-xs">{lang.name}</span>
                  </div>
                </td>
                <td className="py-2 text-right font-mono text-xs text-cyan">
                  {lang.pctA > 0 ? `${lang.pctA}%` : "—"}
                </td>
                <td className="py-2 text-right font-mono text-xs text-violet-400">
                  {lang.pctB > 0 ? `${lang.pctB}%` : "—"}
                </td>
                <td className="py-2 text-right font-mono text-xs text-cyan">
                  {lang.reposA > 0 ? lang.reposA : "—"}
                </td>
                <td className="py-2 text-right font-mono text-xs text-violet-400">
                  {lang.reposB > 0 ? lang.reposB : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

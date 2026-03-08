"use client";

import { StickyBottomBar } from "@/components/ui/sticky-bottom-bar";
import { ExportPdfButton } from "@/components/ui/export-pdf-button";
import { useExportPdf } from "@/hooks/use-export-pdf";

interface ComparisonExportBarProps {
  usernameA: string;
  usernameB: string;
  comparisonRef: React.RefObject<HTMLDivElement | null>;
}

export function ComparisonExportBar({
  usernameA,
  usernameB,
  comparisonRef,
}: ComparisonExportBarProps) {
  const { isExporting, handleExportPDF } = useExportPdf(
    comparisonRef,
    `repofy-comparison-${usernameA}-vs-${usernameB}`,
  );

  return (
    <StickyBottomBar>
      <p className="hidden font-mono text-xs text-muted-foreground sm:block">
        Comparison:{" "}
        <span className="text-cyan">@{usernameA}</span>
        {" "}vs{" "}
        <span className="text-violet-400">@{usernameB}</span>
      </p>
      <div className="flex items-center gap-2 w-full sm:w-auto">
        <ExportPdfButton
          isExporting={isExporting}
          onClick={handleExportPDF}
          label="Export Comparison PDF"
        />
      </div>
    </StickyBottomBar>
  );
}

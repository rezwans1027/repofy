"use client";

import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportToPdf } from "@/lib/export-pdf";

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
  const [isExporting, setIsExporting] = useState(false);

  const handleExportPDF = async () => {
    if (!comparisonRef.current || isExporting) return;

    setIsExporting(true);

    try {
      await new Promise((r) => setTimeout(r, 300));
      const date = new Date().toISOString().split("T")[0];
      await exportToPdf(
        comparisonRef.current,
        `repofy-comparison-${usernameA}-vs-${usernameB}-${date}.pdf`,
      );
    } catch (err) {
      console.error("PDF export failed:", err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 lg:left-48 z-50 border-t border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <p className="hidden font-mono text-xs text-muted-foreground sm:block">
          Comparison:{" "}
          <span className="text-cyan">@{usernameA}</span>
          {" "}vs{" "}
          <span className="text-violet-400">@{usernameB}</span>
        </p>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            size="sm"
            className="bg-cyan text-background hover:bg-cyan/90 font-mono text-xs flex-1 sm:flex-initial"
            onClick={handleExportPDF}
            disabled={isExporting}
          >
            {isExporting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <FileDown className="size-3.5" />
            )}
            {isExporting ? "Exporting..." : "Export Comparison PDF"}
          </Button>
        </div>
      </div>
    </div>
  );
}

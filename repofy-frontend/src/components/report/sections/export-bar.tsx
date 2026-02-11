"use client";

import { useState } from "react";
import Link from "next/link";
import { FileDown, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportToPdf } from "@/lib/export-pdf";

interface ExportBarProps {
  username: string;
  reportRef: React.RefObject<HTMLDivElement | null>;
  onBeforeExport: () => void;
  onAfterExport: () => void;
}

export function ExportBar({ username, reportRef, onBeforeExport, onAfterExport }: ExportBarProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExportPDF = async () => {
    if (!reportRef.current || isExporting) return;

    setIsExporting(true);
    onBeforeExport();

    try {
      await new Promise((r) => setTimeout(r, 300));
      const date = new Date().toISOString().split("T")[0];
      await exportToPdf(reportRef.current, `repofy-report-${username}-${date}.pdf`);
    } catch (err) {
      console.error("PDF export failed:", err);
    } finally {
      onAfterExport();
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 lg:left-48 z-50 border-t border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <p className="hidden font-mono text-xs text-muted-foreground sm:block">
          Report generated for{" "}
          <span className="text-cyan">@{username}</span>
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
            {isExporting ? "Exporting..." : "Export PDF"}
          </Button>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="font-mono text-xs flex-1 sm:flex-initial"
          >
            <Link href={`/generate/${username}`}>
              <RefreshCw className="size-3.5" />
              Re-run
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

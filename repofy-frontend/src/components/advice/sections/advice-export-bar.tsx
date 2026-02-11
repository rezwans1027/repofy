"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileDown, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportToPdf } from "@/lib/export-pdf";

interface AdviceExportBarProps {
  username: string;
  adviceRef: React.RefObject<HTMLDivElement | null>;
  onBeforeExport: () => void;
  onAfterExport: () => void;
}

export function AdviceExportBar({ username, adviceRef, onBeforeExport, onAfterExport }: AdviceExportBarProps) {
  const router = useRouter();
  const [isExporting, setIsExporting] = useState(false);

  const handleExportPDF = async () => {
    if (!adviceRef.current || isExporting) return;

    setIsExporting(true);
    onBeforeExport();

    try {
      await new Promise((r) => setTimeout(r, 300));
      const date = new Date().toISOString().split("T")[0];
      await exportToPdf(adviceRef.current, `repofy-advice-${username}-${date}.pdf`);
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
          Advice for{" "}
          <span className="text-emerald-400">@{username}</span>
        </p>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            size="sm"
            variant="outline"
            className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-400 font-mono text-xs flex-1 sm:flex-initial"
            onClick={() => router.push(`/advisor/generate/${username}`)}
          >
            <RefreshCw className="size-3.5" />
            Run Again
          </Button>
          <Button
            size="sm"
            className="bg-emerald-500 text-background hover:bg-emerald-500/90 font-mono text-xs flex-1 sm:flex-initial"
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
        </div>
      </div>
    </div>
  );
}

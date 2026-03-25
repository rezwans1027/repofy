"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StickyBottomBar } from "@/components/ui/sticky-bottom-bar";
import { ExportPdfButton } from "@/components/ui/export-pdf-button";
import { useExportPdf } from "@/hooks/use-export-pdf";

interface ExportBarProps {
  username: string;
  reportRef: React.RefObject<HTMLDivElement | null>;
  onBeforeExport: () => void;
  onAfterExport: () => void;
}

export function ExportBar({ username, reportRef, onBeforeExport, onAfterExport }: ExportBarProps) {
  const { isExporting, handleExportPDF } = useExportPdf(
    reportRef,
    `repofy-report-${username}`,
    { onBeforeExport, onAfterExport },
  );

  return (
    <StickyBottomBar>
      <p className="hidden font-mono text-xs text-muted-foreground sm:block">
        Report generated for{" "}
        <span className="text-cyan">@{username}</span>
      </p>
      <div className="flex items-center gap-2 w-full sm:w-auto">
        <ExportPdfButton isExporting={isExporting} onClick={handleExportPDF} />
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
    </StickyBottomBar>
  );
}

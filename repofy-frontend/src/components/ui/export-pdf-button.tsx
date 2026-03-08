"use client";

import { FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ExportPdfButtonProps {
  isExporting: boolean;
  onClick: () => void;
  label?: string;
  className?: string;
}

export function ExportPdfButton({
  isExporting,
  onClick,
  label = "Export PDF",
  className = "bg-cyan text-background hover:bg-cyan/90 font-mono text-xs flex-1 sm:flex-initial",
}: ExportPdfButtonProps) {
  return (
    <Button
      size="sm"
      className={className}
      onClick={onClick}
      disabled={isExporting}
    >
      {isExporting ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <FileDown className="size-3.5" />
      )}
      {isExporting ? "Exporting..." : label}
    </Button>
  );
}

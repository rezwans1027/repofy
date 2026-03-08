"use client";

import { useState, useCallback, useRef } from "react";
import { exportToPdf } from "@/lib/export-pdf";

interface UseExportPdfOptions {
  onBeforeExport?: () => void;
  onAfterExport?: () => void;
}

export function useExportPdf(
  ref: React.RefObject<HTMLDivElement | null>,
  filenamePrefix: string,
  options?: UseExportPdfOptions,
) {
  const [isExporting, setIsExporting] = useState(false);
  const isExportingRef = useRef(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const handleExportPDF = useCallback(async () => {
    if (isExportingRef.current) return;
    isExportingRef.current = true;

    setIsExporting(true);
    optionsRef.current?.onBeforeExport?.();

    try {
      // Wait for the off-screen PDF layout to mount
      await new Promise((r) => setTimeout(r, 300));
      if (!ref.current) return;
      const date = new Date().toISOString().split("T")[0];
      await exportToPdf(ref.current, `${filenamePrefix}-${date}.pdf`);
    } catch (err) {
      console.error("PDF export failed:", err);
    } finally {
      optionsRef.current?.onAfterExport?.();
      setIsExporting(false);
      isExportingRef.current = false;
    }
  }, [ref, filenamePrefix]);

  return { isExporting, handleExportPDF };
}

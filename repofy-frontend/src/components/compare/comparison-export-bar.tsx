"use client";

import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

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

      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas-pro"),
        import("jspdf"),
      ]);

      const element = comparisonRef.current;

      const bgColor =
        getComputedStyle(document.documentElement)
          .getPropertyValue("--background")
          .trim();
      const resolvedBg = bgColor || "#0A0A0B";

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: resolvedBg,
        onclone: (doc, clonedEl) => {
          const sheets = doc.querySelectorAll('style, link[rel="stylesheet"]');
          sheets.forEach((sheet) => {
            if (sheet instanceof HTMLStyleElement && sheet.textContent) {
              sheet.textContent = sheet.textContent.replace(
                /[^;{}]*(?:conic|linear|radial)-gradient\([^)]*(?:in\s+(?:oklch|oklab|srgb|display-p3|hsl|lab|lch)[^)]*)\)[^;{}]*/gi,
                ""
              );
            }
          });

          const animated = clonedEl.querySelectorAll("*");
          animated.forEach((el) => {
            const htmlEl = el as HTMLElement;
            const computed = getComputedStyle(htmlEl);
            if (computed.backgroundImage && computed.backgroundImage !== "none") {
              htmlEl.style.backgroundImage = "none";
            }
            htmlEl.style.opacity = "1";
            htmlEl.style.transform = "none";
          });
          const svgAnimated = clonedEl.querySelectorAll("circle, path");
          svgAnimated.forEach((el) => {
            el.removeAttribute("style");
            (el as HTMLElement).style.opacity = "1";
          });
        },
      });

      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = 210;
      const pdfHeight = 297;

      const pageCanvasHeight = Math.floor(
        canvas.height * (pdfHeight / ((canvas.height * pdfWidth) / canvas.width))
      );
      const totalPages = Math.ceil(canvas.height / pageCanvasHeight);

      for (let page = 0; page < totalPages; page++) {
        const sliceY = page * pageCanvasHeight;
        const sliceH = Math.min(pageCanvasHeight, canvas.height - sliceY);

        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvas.width;
        pageCanvas.height = pageCanvasHeight;
        const ctx = pageCanvas.getContext("2d")!;

        ctx.fillStyle = resolvedBg;
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);

        ctx.drawImage(
          canvas,
          0, sliceY, canvas.width, sliceH,
          0, 0, canvas.width, sliceH
        );

        const pageData = pageCanvas.toDataURL("image/png");
        if (page > 0) pdf.addPage();
        pdf.addImage(pageData, "PNG", 0, 0, pdfWidth, pdfHeight);
      }

      const date = new Date().toISOString().split("T")[0];
      pdf.save(`repofy-comparison-${usernameA}-vs-${usernameB}-${date}.pdf`);
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
            {isExporting ? "Exporting…" : "Export Comparison PDF"}
          </Button>
        </div>
      </div>
    </div>
  );
}

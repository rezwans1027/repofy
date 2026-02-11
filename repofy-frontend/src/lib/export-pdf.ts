/**
 * Shared PDF export utility.
 * Captures an HTML element as a paginated A4 PDF using html2canvas-pro + jsPDF.
 */
export async function exportToPdf(
  element: HTMLElement,
  filename: string,
): Promise<void> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ]);

  const bgColor = getComputedStyle(document.documentElement)
    .getPropertyValue("--background")
    .trim();
  const resolvedBg = bgColor || "#0A0A0B";

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: resolvedBg,
    onclone: (_doc, clonedEl) => {
      // Strip stylesheets with unsupported CSS gradients (tw-animate, shadcn)
      const sheets = _doc.querySelectorAll('style, link[rel="stylesheet"]');
      sheets.forEach((sheet) => {
        if (sheet instanceof HTMLStyleElement && sheet.textContent) {
          sheet.textContent = sheet.textContent.replace(
            /[^;{}]*(?:conic|linear|radial)-gradient\([^)]*(?:in\s+(?:oklch|oklab|srgb|display-p3|hsl|lab|lch)[^)]*)\)[^;{}]*/gi,
            "",
          );
        }
      });

      // Force all animated elements to their final state
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

      // Force SVG animated elements (radar chart circles/paths)
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
    canvas.height * (pdfHeight / ((canvas.height * pdfWidth) / canvas.width)),
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
      0,
      sliceY,
      canvas.width,
      sliceH,
      0,
      0,
      canvas.width,
      sliceH,
    );

    const pageData = pageCanvas.toDataURL("image/png");
    if (page > 0) pdf.addPage();
    pdf.addImage(pageData, "PNG", 0, 0, pdfWidth, pdfHeight);
  }

  pdf.save(filename);
}

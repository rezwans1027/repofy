/**
 * Shared PDF export utility.
 * Captures an HTML element as a paginated A4 PDF using html2canvas-pro + jsPDF.
 *
 * Features:
 *  - Clean light theme (white background, professional colors)
 *  - Page margins with page numbers + branding footer
 *  - Section-aware page breaks (avoids cutting through cards)
 *  - Hardcoded dark-mode SVG colors remapped for light background
 */

/* ── Helpers ─────────────────────────────────────────────────────── */

/**
 * Collect the Y-positions (in canvas pixels) where section boundaries occur.
 * These are the preferred page-break locations.
 */
function collectSectionBreaks(
  element: HTMLElement,
  scale: number,
): number[] {
  const containerRect = element.getBoundingClientRect();
  const breaks = new Set<number>();

  // Direct children of the target element
  for (const child of element.children) {
    const y = Math.round(
      ((child as HTMLElement).getBoundingClientRect().top - containerRect.top) *
        scale,
    );
    if (y > 0) breaks.add(y);
  }

  // Children inside a [data-pdf-sections] wrapper (advice report PDF mode)
  const sectionsWrapper = element.querySelector("[data-pdf-sections]");
  if (sectionsWrapper) {
    for (const child of sectionsWrapper.children) {
      const y = Math.round(
        ((child as HTMLElement).getBoundingClientRect().top -
          containerRect.top) *
          scale,
      );
      if (y > 0) breaks.add(y);
    }
  }

  return [...breaks].sort((a, b) => a - b);
}

/**
 * Determine page-break Y-positions, snapping to section boundaries
 * when possible to avoid splitting cards mid-way.
 */
function findPageBreaks(
  totalHeight: number,
  maxSliceHeight: number,
  sectionBreaks: number[],
): number[] {
  const pages: number[] = [0];
  let currentY = 0;

  while (currentY + maxSliceHeight < totalHeight) {
    const idealBreak = currentY + maxSliceHeight;

    // Find the largest section break that fits within this page
    // but don't create a page shorter than 35% capacity
    const minY = currentY + maxSliceHeight * 0.35;
    let bestBreak = idealBreak;

    for (let i = sectionBreaks.length - 1; i >= 0; i--) {
      if (sectionBreaks[i] <= idealBreak && sectionBreaks[i] > minY) {
        bestBreak = sectionBreaks[i];
        break;
      }
    }

    currentY = bestBreak;
    pages.push(currentY);
  }

  return pages;
}

/** Dark-mode hardcoded hex → light-mode equivalents */
const SVG_COLOR_MAP: Record<string, string> = {
  "#22D3EE": "#0891B2",
  "#22d3ee": "#0891B2",
  "#A78BFA": "#7C3AED",
  "#a78bfa": "#7C3AED",
  "#34D399": "#059669",
  "#34d399": "#059669",
  "#FBBF24": "#D97706",
  "#fbbf24": "#D97706",
  "#F472B6": "#DB2777",
  "#f472b6": "#DB2777",
};

/** CSS custom property overrides for the clean PDF light theme */
const PDF_THEME_CSS = `
  :root, .dark {
    --background: #FFFFFF !important;
    --foreground: #1A1A1A !important;
    --card: #FFFFFF !important;
    --card-foreground: #1A1A1A !important;
    --popover: #FFFFFF !important;
    --popover-foreground: #1A1A1A !important;
    --secondary: #F5F5F7 !important;
    --secondary-foreground: #4A4A52 !important;
    --muted: #F5F5F7 !important;
    --muted-foreground: #6B6B73 !important;
    --accent: #F5F5F7 !important;
    --accent-foreground: #1A1A1A !important;
    --border: #E0E0E5 !important;
    --input: #E0E0E5 !important;
    --cyan: #0891B2 !important;
    --cyan-dim: #0891B280 !important;
    --primary: #0891B2 !important;
    --primary-foreground: #FFFFFF !important;
    --ring: #0891B2 !important;
    --destructive: #DC2626 !important;
    color-scheme: light !important;
  }
`;

/* ── Main export ─────────────────────────────────────────────────── */

export async function exportToPdf(
  element: HTMLElement,
  filename: string,
): Promise<void> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ]);

  const scale = 2;
  const pdfBg = "#FFFFFF";

  // Collect section boundaries BEFORE capture (DOM is already in PDF mode)
  const sectionBreaks = collectSectionBreaks(element, scale);

  // Capture full element as a single high-res canvas
  // useCORS fetches cross-origin images (GitHub avatars) with CORS headers,
  // keeping the canvas untainted so toDataURL() works reliably.
  // allowTaint is explicitly false to prevent silent taint that would break
  // canvas export in some browsers.
  const canvas = await html2canvas(element, {
    scale,
    useCORS: true,
    allowTaint: false,
    backgroundColor: pdfBg,
    onclone: (_doc, clonedEl) => {
      // ── 1. Switch to light PDF theme ──
      _doc.documentElement.classList.remove("dark");
      _doc.documentElement.style.colorScheme = "light";

      const themeStyle = _doc.createElement("style");
      themeStyle.textContent = PDF_THEME_CSS;
      _doc.head.appendChild(themeStyle);

      // ── 2. Strip unsupported CSS gradients (tw-animate, shadcn) ──
      _doc.querySelectorAll('style, link[rel="stylesheet"]').forEach((sheet) => {
        if (sheet instanceof HTMLStyleElement && sheet.textContent) {
          sheet.textContent = sheet.textContent.replace(
            /[^;{}]*(?:conic|linear|radial)-gradient\([^)]*(?:in\s+(?:oklch|oklab|srgb|display-p3|hsl|lab|lch)[^)]*)\)[^;{}]*/gi,
            "",
          );
        }
      });

      // ── 3. Freeze animated elements at final state ──
      clonedEl.querySelectorAll("*").forEach((el) => {
        const htmlEl = el as HTMLElement;
        const computed = getComputedStyle(htmlEl);
        if (computed.backgroundImage && computed.backgroundImage !== "none") {
          htmlEl.style.backgroundImage = "none";
        }
        htmlEl.style.opacity = "1";
        // Skip transform reset on SVG elements (preserves chart rotations)
        if (!el.closest("svg") && el.tagName.toLowerCase() !== "svg") {
          htmlEl.style.transform = "none";
        }
      });

      // ── 4. Fix SVG animated elements ──
      clonedEl.querySelectorAll("circle, path").forEach((el) => {
        const htmlEl = el as HTMLElement;
        htmlEl.style.opacity = "1";
        htmlEl.style.animation = "none";
        htmlEl.style.transition = "none";
      });

      // ── 5. Remap hardcoded dark-mode SVG colors ──
      clonedEl.querySelectorAll("svg *").forEach((el) => {
        for (const attr of ["fill", "stroke"]) {
          const val = el.getAttribute(attr);
          if (val && SVG_COLOR_MAP[val]) {
            el.setAttribute(attr, SVG_COLOR_MAP[val]);
          }
        }
        const s = (el as HTMLElement).style;
        if (s.stroke && SVG_COLOR_MAP[s.stroke]) s.stroke = SVG_COLOR_MAP[s.stroke];
        if (s.fill && SVG_COLOR_MAP[s.fill]) s.fill = SVG_COLOR_MAP[s.fill];
      });
    },
  });

  /* ── PDF layout constants (mm) ───────────────────────────────── */
  const pdf = new jsPDF("p", "mm", "a4");
  const pageW = 210;
  const pageH = 297;
  const mX = 10;
  const mTop = 12;
  const mBottom = 14;
  const contentW = pageW - 2 * mX;
  const contentH = pageH - mTop - mBottom;

  const pxToMm = contentW / canvas.width;
  const maxSliceH = Math.floor(contentH / pxToMm);

  /* ── Paginate ────────────────────────────────────────────────── */
  const breakPoints = findPageBreaks(canvas.height, maxSliceH, sectionBreaks);
  const totalPages = breakPoints.length;

  for (let i = 0; i < totalPages; i++) {
    const sliceY = breakPoints[i];
    const nextY = i + 1 < totalPages ? breakPoints[i + 1] : canvas.height;
    const sliceH = nextY - sliceY;

    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = canvas.width;
    pageCanvas.height = sliceH;
    const ctx = pageCanvas.getContext("2d")!;

    ctx.fillStyle = pdfBg;
    ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
    ctx.drawImage(
      canvas,
      0, sliceY, canvas.width, sliceH,
      0, 0, canvas.width, sliceH,
    );

    const imgData = pageCanvas.toDataURL("image/png");
    const imgH = sliceH * pxToMm;

    if (i > 0) pdf.addPage();

    // White page background (fills margins)
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, pageW, pageH, "F");

    // Content image with margins
    pdf.addImage(imgData, "PNG", mX, mTop, contentW, imgH);

    // ── Footer ──
    pdf.setDrawColor(210, 210, 215);
    pdf.setLineWidth(0.2);
    pdf.line(mX, pageH - mBottom + 2, pageW - mX, pageH - mBottom + 2);

    pdf.setFontSize(7);
    pdf.setTextColor(160, 160, 165);
    pdf.text(
      `${i + 1} / ${totalPages}`,
      pageW / 2,
      pageH - 7,
      { align: "center" },
    );

    pdf.setTextColor(180, 180, 185);
    pdf.text("repofy.com", pageW - mX, pageH - 7, { align: "right" });
  }

  pdf.save(filename);
}

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/__tests__/setup.ts"],
    css: false,
    restoreMocks: true,
    exclude: ["**/e2e/**", "**/node_modules/**"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/__tests__/**",
        "src/**/*.test.{ts,tsx}",
        "src/**/*.spec.{ts,tsx}",
        "src/shared/types/**",
        "src/middleware.ts",
        // Next.js app directory conventions — tested via E2E
        "src/app/**/page.tsx",
        "src/app/**/layout.tsx",
        "src/app/**/loading.tsx",
        "src/app/**/error.tsx",
        "src/app/**/global-error.tsx",
        "src/app/**/not-found.tsx",
        "src/app/**/route.ts",
        "src/app/**/opengraph-image.tsx",
        "src/app/robots.ts",
        "src/app/sitemap.ts",
        // Instrumentation
        "src/instrumentation.ts",
        // Browser-only components impractical to unit test
        "src/components/report/pdf-layout.tsx",
        "src/components/advice/advice-pdf-layout.tsx",
        "src/components/ui/overlay-scrollbar.tsx",
        // shadcn/ui primitives — thin wrappers over Radix UI
        "src/components/ui/popover.tsx",
        "src/components/ui/select.tsx",
        "src/components/ui/separator.tsx",
        "src/components/ui/slider.tsx",
        "src/components/ui/tabs.tsx",
        "src/components/ui/dialog.tsx",
        // Landing page section components — visual/marketing, tested via E2E
        "src/components/sections/advisor-preview.tsx",
        "src/components/sections/analysis-preview.tsx",
        "src/components/sections/compare-preview.tsx",
        "src/components/sections/features-overview.tsx",
        "src/components/sections/final-cta.tsx",
        "src/components/sections/how-it-works.tsx",
        "src/components/sections/pricing.tsx",
        "src/components/sections/verdict.tsx",
        // Layout components — visual wrappers tested via E2E
        "src/components/layout/footer.tsx",
        "src/components/layout/section-nav.tsx",
        "src/components/layout/page-container.tsx",
        // Legal content — static display component
        "src/app/(legal)/legal-content.tsx",
        // Server-side / environment config — not unit-testable
        "src/lib/server-api.ts",
        "src/lib/supabase.ts",
        // Browser-only PDF export utility
        "src/lib/export-pdf.ts",
      ],
      thresholds: {
        lines: 75,
        functions: 70,
        branches: 65,
        statements: 75,
      },
    },
  },
});

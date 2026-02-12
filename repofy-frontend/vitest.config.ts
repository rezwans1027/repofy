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
      include: [
        "src/lib/api-client.ts",
        "src/lib/supabase-queries.ts",
        "src/lib/utils.ts",
        "src/hooks/**/*.ts",
        "src/components/providers/**/*.{ts,tsx}",
        "src/components/layout/**/*.{ts,tsx}",
        "src/components/report/analysis-loading.tsx",
        "src/components/report/analysis-report.tsx",
        "src/components/report/sections/**/*.tsx",
        "src/components/advice/**/*.tsx",
        "src/components/compare/**/*.tsx",
        "src/components/ui/radar-chart.tsx",
        "src/app/(app)/dashboard/page.tsx",
        "src/app/(app)/reports/page.tsx",
        "src/app/(app)/compare/page.tsx",
        "src/app/(auth)/login/page.tsx",
        "src/components/profile/sticky-cta-bar.tsx",
        "src/components/sections/hero.tsx",
        "src/components/ui/count-up.tsx",
        "src/components/ui/heatmap-grid.tsx",
        "src/components/ui/metric-bar.tsx",
        "src/app/(app)/profile/[username]/page.tsx",
        "src/app/(app)/report/[id]/page.tsx",
        "src/app/(app)/advisor/page.tsx",
        "src/app/(app)/generate/[username]/page.tsx",
      ],
      exclude: [
        "src/__tests__/**",
        "src/**/*.test.{ts,tsx}",
        "src/**/*.spec.{ts,tsx}",
      ],
      thresholds: {
        lines: 60,
        functions: 55,
        branches: 50,
        statements: 60,
      },
    },
  },
});

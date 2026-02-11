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
        "src/hooks/*.ts",
        "src/components/providers/auth-provider.tsx",
        "src/components/providers/analysis-provider.tsx",
        "src/components/layout/navbar.tsx",
        "src/components/layout/app-sidebar.tsx",
        "src/components/ui/radar-chart.tsx",
        "src/components/report/analysis-report.tsx",
        "src/components/report/analysis-loading.tsx",
        "src/app/(auth)/login/page.tsx",
        "src/app/(app)/dashboard/page.tsx",
        "src/app/(app)/reports/page.tsx",
        "src/app/(app)/compare/page.tsx",
      ],
      exclude: ["src/__tests__/**"],
      thresholds: {
        lines: 60,
        functions: 55,
        branches: 50,
        statements: 60,
      },
    },
  },
});

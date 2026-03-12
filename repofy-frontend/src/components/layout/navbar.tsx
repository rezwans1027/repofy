"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useAuth } from "@/components/providers/auth-provider";
import { useCreditBalance } from "@/hooks/use-credits";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Sun, Moon, Zap, BarChart3 } from "lucide-react";

export function Navbar() {
  const { user, isLoading } = useAuth();
  const { data: credits } = useCreditBalance();
  const pathname = usePathname();
  const isLandingPage = pathname === "/";
  const { theme, setTheme } = useTheme();
  const showCredits = !isLoading && user && !isLandingPage;
  const hasData = !!credits;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="absolute left-0 lg:left-48 top-0 flex h-14 items-center px-4 sm:px-6">
        <Link
          href={user ? "/dashboard" : "/"}
          className="flex items-center gap-2 hover:opacity-60 transition-opacity duration-150 ease-out will-change-[opacity]"
        >
          <span className="text-cyan font-mono text-lg font-bold tracking-tight">
            repofy
          </span>
          <span className="text-muted-foreground font-mono text-xs">v0.1</span>
        </Link>
      </div>

      <div className="absolute right-0 top-0 flex h-14 items-center gap-2 px-4 sm:px-6">
        {showCredits && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/pricing"
                  className="flex items-center rounded-md border border-border bg-muted/50 py-1.5 font-mono text-xs animate-in fade-in duration-300 hover:bg-muted"
                  style={{ paddingInline: hasData ? 12 : 8, gap: hasData ? 12 : 6 }}
                >
                  <span className="flex items-center gap-1 text-emerald-400">
                    <Zap className="h-3.5 w-3.5" />
                    <span
                      className="inline-block overflow-hidden transition-all duration-300 ease-out"
                      style={{ width: hasData ? "auto" : 0, opacity: hasData ? 1 : 0 }}
                    >
                      {credits?.growth_balance ?? 0}
                    </span>
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground opacity-40">
                    <BarChart3 className="h-3.5 w-3.5" />
                    <span
                      className="inline-block overflow-hidden transition-all duration-300 ease-out"
                      style={{ width: hasData ? "auto" : 0, opacity: hasData ? 1 : 0 }}
                    >
                      {credits?.eval_balance ?? 0}
                    </span>
                  </span>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={8}>
                <div className="flex flex-col gap-1.5 py-0.5">
                  <span className="flex items-center gap-1.5">
                    <Zap className="h-3 w-3 text-emerald-400" />
                    <span>Growth credits — generate advisor reports</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <BarChart3 className="h-3 w-3" />
                    <span>Eval credits — run developer evaluations</span>
                  </span>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        <Button
          size="icon"
          variant="ghost"
          onClick={() => {
            const next = theme === "dark" ? "light" : "dark";
            if (document.startViewTransition) {
              document.startViewTransition(() => setTheme(next));
            } else {
              setTheme(next);
            }
          }}
          className="h-8 w-8"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>

        {!isLoading && user && isLandingPage ? (
          <Button
            size="sm"
            className="bg-cyan text-background hover:bg-cyan/90 font-mono text-xs"
            asChild
          >
            <Link href="/dashboard">Dashboard</Link>
          </Button>
        ) : !isLoading && !user ? (
          <Button
            size="sm"
            className="bg-cyan text-background hover:bg-cyan/90 font-mono text-xs"
            asChild
          >
            <Link href="/login">Get Started</Link>
          </Button>
        ) : null}
      </div>
    </header>
  );
}

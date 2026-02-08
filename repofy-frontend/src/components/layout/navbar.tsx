"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sun, Moon } from "lucide-react";

export function Navbar() {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const isLandingPage = pathname === "/";
  const { theme, setTheme } = useTheme();

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

        {isLoading ? (
          <Skeleton className="h-8 w-24" />
        ) : user && isLandingPage ? (
          <Button
            size="sm"
            className="bg-cyan text-background hover:bg-cyan/90 font-mono text-xs"
            asChild
          >
            <Link href="/dashboard">Dashboard</Link>
          </Button>
        ) : !user ? (
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

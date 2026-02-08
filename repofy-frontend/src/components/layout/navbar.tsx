"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function Navbar() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isLandingPage = pathname === "/";

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

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

      <div className="absolute right-0 top-0 flex h-14 items-center px-4 sm:px-6">
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
        ) : user ? (
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-muted-foreground hidden sm:inline">
              {user.email}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={handleSignOut}
              className="font-mono text-xs"
            >
              Sign Out
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            className="bg-cyan text-background hover:bg-cyan/90 font-mono text-xs"
            asChild
          >
            <Link href="/login">Get Started</Link>
          </Button>
        )}
      </div>
    </header>
  );
}

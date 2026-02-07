"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function Navbar() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link
          href={user ? "/dashboard" : "/"}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <span className="text-cyan font-mono text-lg font-bold tracking-tight">
            repofy
          </span>
          <span className="text-muted-foreground font-mono text-xs">v0.1</span>
        </Link>

        {isLoading ? (
          <Skeleton className="h-8 w-24" />
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

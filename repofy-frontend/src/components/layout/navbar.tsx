"use client";

import { Button } from "@/components/ui/button";

export function Navbar() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="text-cyan font-mono text-lg font-bold tracking-tight">
            repofy
          </span>
          <span className="text-muted-foreground font-mono text-xs">v0.1</span>
        </div>
        <Button
          size="sm"
          className="bg-cyan text-background hover:bg-cyan/90 font-mono text-xs"
        >
          Get Started
        </Button>
      </div>
    </header>
  );
}

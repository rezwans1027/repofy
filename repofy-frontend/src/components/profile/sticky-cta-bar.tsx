"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

interface StickyCTABarProps {
  username: string;
  delay?: number;
}

export function StickyCTABar({ username, delay = 50 }: StickyCTABarProps) {
  const router = useRouter();
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 lg:left-48 z-50 border-t border-border bg-background/80 backdrop-blur-md transition-all duration-500 ${show ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"}`}
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <div className="hidden sm:block">
          <p className="font-mono text-sm font-bold">
            Analyze <span className="text-cyan">@{username}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            Generate a hiring-grade developer evaluation
          </p>
        </div>
        <Button
          size="lg"
          className="bg-cyan text-background hover:bg-cyan/90 font-mono text-sm px-8 w-full sm:w-auto"
          onClick={() => router.push(`/report/${username}`)}
        >
          <Sparkles className="size-4" />
          Start Analysis
        </Button>
      </div>
    </div>
  );
}

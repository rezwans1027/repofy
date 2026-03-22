"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { AnimateOnView } from "@/components/ui/animate-on-view";

interface ComingSoonCardProps {
  icon: ReactNode;
  title: string;
  description: string;
}

export function ComingSoonCard({
  icon,
  title,
  description,
}: ComingSoonCardProps) {
  return (
    <AnimateOnView>
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="max-w-md text-center">
          {icon}
          <Badge className="mt-4 border-cyan/30 bg-cyan/10 text-cyan font-mono text-[10px] uppercase tracking-wider">
            Coming Soon
          </Badge>
          <h1 className="mt-3 font-mono text-lg font-bold">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            {description}
          </p>
        </div>
      </div>
    </AnimateOnView>
  );
}

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface BackLinkProps {
  href: string;
  label: string;
  /** Full hover class, e.g. "hover:text-cyan" or "hover:text-emerald-400" */
  hoverColor?: string;
}

export function BackLink({
  href,
  label,
  hoverColor = "hover:text-cyan",
}: BackLinkProps) {
  return (
    <div className="mb-4">
      <Link
        href={href}
        className={cn(
          "inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground transition-colors",
          hoverColor,
        )}
      >
        <ArrowLeft className="size-3" />
        {label}
      </Link>
    </div>
  );
}

import { cn } from "@/lib/utils";

interface TerminalWindowProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function TerminalWindow({
  title = "terminal",
  children,
  className,
}: TerminalWindowProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-card",
        className
      )}
    >
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-[#EF4444]" />
        <span className="h-3 w-3 rounded-full bg-[#FBBF24]" />
        <span className="h-3 w-3 rounded-full bg-[#22C55E]" />
        <span className="ml-2 font-mono text-xs text-muted-foreground">
          {title}
        </span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

import { cn } from "@/lib/utils";

interface ErrorCardProps {
  message: string;
  detail?: string;
  variant?: "neutral" | "error";
  children?: React.ReactNode;
}

export function ErrorCard({
  message,
  detail,
  variant = "error",
  children,
}: ErrorCardProps) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div
        className={cn(
          "rounded-lg border p-6 text-center max-w-md",
          variant === "error"
            ? "border-red-500/30 bg-red-500/5"
            : "border-border bg-card",
        )}
      >
        <p
          className={cn(
            "font-mono text-sm",
            variant === "error" ? "text-red-400" : "text-muted-foreground",
          )}
        >
          {message}
        </p>
        {detail && (
          <p className="mt-2 text-xs text-muted-foreground/70">{detail}</p>
        )}
        {children}
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Page Not Found" };

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="font-mono text-6xl font-extrabold tracking-tight text-cyan">
        404
      </h1>
      <p className="font-mono text-sm text-muted-foreground">
        Page not found
      </p>
      <div className="mt-4 flex items-center gap-4">
        <Link
          href="/"
          className="rounded-md bg-cyan px-4 py-2 font-mono text-xs font-semibold text-background transition-[filter] hover:brightness-110"
        >
          Home
        </Link>
        <Link
          href="/dashboard"
          className="rounded-md border border-border px-4 py-2 font-mono text-xs font-semibold text-foreground transition-colors hover:bg-secondary"
        >
          Dashboard
        </Link>
      </div>
    </div>
  );
}

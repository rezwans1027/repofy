import Link from "next/link";
import { cn } from "@/lib/utils";

interface FooterProps {
  withSidebar?: boolean;
}

export function Footer({ withSidebar = true }: FooterProps) {
  return (
    <footer className={cn("border-t border-border py-8", withSidebar && "lg:pl-48")}>
      <div className="mx-auto flex max-w-4xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <span className="text-cyan font-mono text-sm font-bold">repofy</span>
          <span className="text-muted-foreground text-sm">
            AI-powered GitHub analysis for technical hiring.
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/privacy"
            className="text-muted-foreground hover:text-foreground text-sm"
          >
            Privacy
          </Link>
          <Link
            href="/terms"
            className="text-muted-foreground hover:text-foreground text-sm"
          >
            Terms
          </Link>
          <Link
            href="/cookies"
            className="text-muted-foreground hover:text-foreground text-sm"
          >
            Cookies
          </Link>
          <a
            href="https://github.com/rezwans1027/repofy"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Repofy on GitHub"
            className="text-muted-foreground hover:text-foreground text-sm"
          >
            GitHub
          </a>
          <span className="text-muted-foreground text-xs">
            &copy; {new Date().getFullYear()} Repofy
          </span>
        </div>
      </div>
    </footer>
  );
}

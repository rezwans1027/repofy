export function Footer() {
  return (
    <footer className="border-t border-border py-8 lg:pl-48">
      <div className="mx-auto flex max-w-4xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <span className="text-cyan font-mono text-sm font-bold">repofy</span>
          <span className="text-muted-foreground text-sm">
            AI-powered GitHub analysis for technical hiring.
          </span>
        </div>
        <div className="flex items-center gap-4">
          <a
            href="https://github.com/repofy"
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

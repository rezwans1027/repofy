export function Footer() {
  return (
    <footer className="border-t border-border py-8 lg:pl-48">
      <div className="mx-auto flex max-w-4xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <span className="text-cyan font-mono text-sm font-bold">repofy</span>
          <span className="text-muted-foreground text-sm">
            Built for developers who hire developers.
          </span>
        </div>
        <div className="flex items-center gap-4">
          <a
            href="#"
            className="text-muted-foreground hover:text-foreground text-sm transition-colors"
          >
            GitHub
          </a>
          <a
            href="#"
            className="text-muted-foreground hover:text-foreground text-sm transition-colors"
          >
            Twitter
          </a>
        </div>
      </div>
    </footer>
  );
}

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
}

export function SectionHeader({ title, subtitle }: SectionHeaderProps) {
  return (
    <div className="mb-4">
      <h2 className="font-mono text-base font-bold tracking-tight sm:text-lg">
        <span className="text-cyan mr-2">.</span>
        {title}
      </h2>
      {subtitle && (
        <p className="text-muted-foreground mt-1 text-xs">{subtitle}</p>
      )}
    </div>
  );
}

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
}

export function SectionHeader({ title, subtitle }: SectionHeaderProps) {
  return (
    <div className="mb-8">
      <h2 className="font-mono text-xl font-bold tracking-tight sm:text-2xl">
        <span className="text-cyan mr-2">.</span>
        {title}
      </h2>
      {subtitle && (
        <p className="text-muted-foreground mt-2 text-sm">{subtitle}</p>
      )}
    </div>
  );
}

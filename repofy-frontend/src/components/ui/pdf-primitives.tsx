export { stripMarkdown } from "@/lib/format";

export function Divider() {
  return <div className="border-b border-foreground/10" />;
}

export function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-3">
      {children}
    </h2>
  );
}

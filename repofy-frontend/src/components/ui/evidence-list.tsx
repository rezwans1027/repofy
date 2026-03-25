import type { LucideIcon } from "lucide-react";

interface EvidenceItem { text: string; evidence: string }
interface EvidenceListProps {
  items: EvidenceItem[];
  icon: LucideIcon;
  iconColor: string;
}

export function EvidenceList({ items, icon: Icon, iconColor }: EvidenceListProps) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.text} className="flex gap-3">
          <Icon className={`size-4 shrink-0 ${iconColor} mt-0.5`} />
          <div>
            <p className="text-sm">{item.text}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{item.evidence}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

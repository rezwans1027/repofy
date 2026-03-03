import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ComingSoonCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

export function ComingSoonCard({
  icon: Icon,
  title,
  description,
}: ComingSoonCardProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-md text-center">
        <Icon className="mx-auto size-10 text-muted-foreground/30" />
        <Badge className="mt-4 border-cyan/30 bg-cyan/10 text-cyan font-mono text-[10px] uppercase tracking-wider">
          Coming Soon
        </Badge>
        <h1 className="mt-3 font-mono text-lg font-bold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
}

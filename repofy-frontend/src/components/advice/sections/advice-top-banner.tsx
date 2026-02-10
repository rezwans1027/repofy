import { AnimateOnView } from "@/components/ui/animate-on-view";
import { Badge } from "@/components/ui/badge";

interface AdviceTopBannerProps {
  username: string;
  avatarUrl?: string;
}

export function AdviceTopBanner({ username, avatarUrl }: AdviceTopBannerProps) {
  return (
    <AnimateOnView delay={0}>
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-center gap-4">
          <div className="relative">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={username}
                className="h-16 w-16 rounded-full border-2 border-emerald-400/30"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-emerald-400/30 bg-secondary font-mono text-xl font-bold text-emerald-400">
                {username.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <h1 className="font-mono text-lg font-bold tracking-tight">
              @{username}
            </h1>
            <p className="font-mono text-sm text-muted-foreground">
              Profile Advisor
            </p>
            <div className="mt-1.5">
              <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px]">
                Actionable Advice
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </AnimateOnView>
  );
}

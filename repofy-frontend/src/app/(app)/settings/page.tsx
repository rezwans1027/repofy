"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/lib/supabase/client";
import { SectionHeader } from "@/components/ui/section-header";
import { AnimateOnView } from "@/components/ui/animate-on-view";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export default function SettingsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="space-y-10">
      <AnimateOnView delay={0}>
        <SectionHeader
          title="Settings"
          subtitle="Manage your account preferences"
        />
      </AnimateOnView>

      {/* Account Info */}
      <AnimateOnView delay={0.05}>
        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <h3 className="font-mono text-sm font-bold">Account</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-muted-foreground">
                Email
              </span>
              {isLoading ? (
                <Skeleton className="h-4 w-48" />
              ) : (
                <span className="font-mono text-xs text-foreground">
                  {user?.email}
                </span>
              )}
            </div>
            <div className="border-t border-border" />
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-muted-foreground">
                Display Name
              </span>
              {isLoading ? (
                <Skeleton className="h-4 w-32" />
              ) : (
                <span className="font-mono text-xs text-foreground">
                  {user?.user_metadata?.display_name || "—"}
                </span>
              )}
            </div>
            <div className="border-t border-border" />
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-muted-foreground">
                Member Since
              </span>
              {isLoading ? (
                <Skeleton className="h-4 w-28" />
              ) : (
                <span className="font-mono text-xs text-foreground">
                  {user?.created_at
                    ? new Date(user.created_at).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                      })
                    : "—"}
                </span>
              )}
            </div>
          </div>
        </div>
      </AnimateOnView>

      {/* Sign Out */}
      <AnimateOnView delay={0.1}>
        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <h3 className="font-mono text-sm font-bold">Session</h3>
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-muted-foreground">
              Sign out of your account
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={handleSignOut}
              className="font-mono text-xs gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </Button>
          </div>
        </div>
      </AnimateOnView>
    </div>
  );
}

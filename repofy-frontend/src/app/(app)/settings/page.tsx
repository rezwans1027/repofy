import { createClient } from "@/lib/supabase/server";
import { AnimateOnView } from "@/components/ui/animate-on-view";
import { SignOutButton } from "@/components/settings/sign-out-button";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="space-y-10">
      <AnimateOnView delay={0}>
        <div className="mb-4">
          <h2 className="font-mono text-base font-bold tracking-tight sm:text-lg">
            Settings
          </h2>
          <p className="text-muted-foreground mt-1 text-xs">Manage your account preferences</p>
        </div>
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
              <span className="font-mono text-xs text-foreground">
                {user?.email}
              </span>
            </div>
            <div className="border-t border-border" />
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-muted-foreground">
                Display Name
              </span>
              <span className="font-mono text-xs text-foreground">
                {user?.user_metadata?.display_name || "—"}
              </span>
            </div>
            <div className="border-t border-border" />
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-muted-foreground">
                Member Since
              </span>
              <span className="font-mono text-xs text-foreground">
                {user?.created_at
                  ? new Date(user.created_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                    })
                  : "—"}
              </span>
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
            <SignOutButton />
          </div>
        </div>
      </AnimateOnView>
    </div>
  );
}

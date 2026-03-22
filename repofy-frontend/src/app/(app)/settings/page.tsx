import type { Metadata } from "next";
import { cookies } from "next/headers";
import { AnimateOnView } from "@/components/ui/animate-on-view";
import { SignOutButton } from "@/components/settings/sign-out-button";
import { PurchaseHistory } from "@/components/settings/purchase-history";
import { ExportDataButton } from "@/components/settings/export-data-button";
import { DeleteAccountButton } from "@/components/settings/delete-account-button";

export const metadata: Metadata = {
  title: "Settings",
  description: "Manage your Repofy account preferences and session.",
};

async function getUser() {
  const backendUrl = process.env.API_BACKEND_URL || "http://localhost:3001/api";
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll().map((c) => `${c.name}=${c.value}`).join("; ");

  try {
    const res = await fetch(`${backendUrl}/auth/me`, {
      headers: { Cookie: cookieHeader },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data?.user as { id: string; email: string; display_name?: string; github_username?: string; avatar_url?: string } | null;
  } catch {
    return null;
  }
}

export default async function SettingsPage() {
  const user = await getUser();

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
                {user?.display_name || user?.github_username || "—"}
              </span>
            </div>
            <div className="border-t border-border" />
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-muted-foreground">
                GitHub
              </span>
              <span className="font-mono text-xs text-foreground">
                {user?.github_username ? `@${user.github_username}` : "—"}
              </span>
            </div>
          </div>
        </div>
      </AnimateOnView>

      {/* Purchase History */}
      <AnimateOnView delay={0.1}>
        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <h3 className="font-mono text-sm font-bold">Purchase History</h3>
          <PurchaseHistory />
        </div>
      </AnimateOnView>

      {/* Your Data */}
      <AnimateOnView delay={0.15}>
        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <h3 className="font-mono text-sm font-bold">Your Data</h3>
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-muted-foreground">
              Download a copy of all your data
            </span>
            <ExportDataButton />
          </div>
        </div>
      </AnimateOnView>

      {/* Session */}
      <AnimateOnView delay={0.2}>
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

      {/* Danger Zone */}
      <AnimateOnView delay={0.25}>
        <div className="rounded-lg border border-destructive/30 bg-card p-6 space-y-4">
          <h3 className="font-mono text-sm font-bold text-destructive">Danger Zone</h3>
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-muted-foreground">
              Permanently delete your account and all associated data
            </span>
            <DeleteAccountButton />
          </div>
        </div>
      </AnimateOnView>
    </div>
  );
}

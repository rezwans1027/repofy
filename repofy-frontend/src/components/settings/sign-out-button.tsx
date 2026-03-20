"use client";

import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    await api.post("/auth/logout");
    router.push("/");
    router.refresh();
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleSignOut}
      className="font-mono text-xs gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
    >
      <LogOut className="h-3.5 w-3.5" />
      Sign Out
    </Button>
  );
}

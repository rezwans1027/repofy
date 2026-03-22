"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { api } from "@/lib/api-client";
import { getSupabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2, Loader2 } from "lucide-react";

export function DeleteAccountButton() {
  const { user } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);

  const emailMatch =
    !!user?.email &&
    !!confirmation &&
    confirmation.toLowerCase() === user.email.toLowerCase();

  async function handleDelete() {
    if (!emailMatch) return;
    setLoading(true);
    try {
      await api.delete("/auth/account", {
        body: { confirmation },
      });
      await getSupabase().auth.signOut();
      router.push("/");
      router.refresh();
    } catch {
      // Error handled by api-client
      setLoading(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setConfirmation(""); setLoading(false); } }}>
      <AlertDialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="font-mono text-xs gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete Account
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-mono">Delete your account?</AlertDialogTitle>
          <AlertDialogDescription>
            This action is permanent and cannot be undone. All your data — reports, advice, credits, and GitHub connection — will be permanently deleted.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2">
          <label className="font-mono text-xs text-muted-foreground">
            Type <span className="text-foreground">{user?.email}</span> to confirm
          </label>
          <Input
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            placeholder="your@email.com"
            className="font-mono text-xs"
            autoComplete="off"
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel size="sm" className="font-mono text-xs">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            size="sm"
            variant="destructive"
            className="font-mono text-xs"
            disabled={!emailMatch || loading}
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              "Delete my account"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

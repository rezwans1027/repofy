"use client";

import Link from "next/link";
import { Coins } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

interface NoCreditsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NoCreditsDialog({ open, onOpenChange }: NoCreditsDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-mono">
            No growth credits
          </AlertDialogTitle>
          <AlertDialogDescription>
            You need at least 1 growth credit to get advice. Purchase credits to
            continue.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel size="sm" className="font-mono text-xs">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            size="sm"
            className="bg-cyan text-background hover:bg-cyan/90 font-mono text-xs"
            asChild
          >
            <Link href="/pricing">
              <Coins className="size-3.5" />
              Buy Credits
            </Link>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

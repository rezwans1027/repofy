"use client";

import { Lightbulb } from "lucide-react";
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

interface CreditConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  username: string;
  balance: number;
  actionVerb: string;
  onConfirm: () => void;
}

export function CreditConfirmDialog({
  open,
  onOpenChange,
  username,
  balance,
  actionVerb,
  onConfirm,
}: CreditConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-mono">
            Use 1 growth credit
          </AlertDialogTitle>
          <AlertDialogDescription>
            {actionVerb} advice for{" "}
            <span className="font-mono font-medium text-foreground">
              @{username}
            </span>{" "}
            will use{" "}
            <span className="font-mono font-medium text-emerald-400">
              1 growth credit
            </span>
            {actionVerb === "Regenerating" &&
              " and replace the current advice"}
            . You currently have{" "}
            <span className="font-mono font-medium text-foreground">
              {balance}
            </span>{" "}
            credit{balance !== 1 ? "s" : ""}.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel size="sm" className="font-mono text-xs">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            size="sm"
            className="bg-emerald-500 text-background hover:bg-emerald-500/90 font-mono text-xs"
            onClick={onConfirm}
          >
            <Lightbulb className="size-3.5" />
            Continue
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

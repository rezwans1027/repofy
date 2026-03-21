"use client";

import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
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
import type { AdviceJob } from "@/hooks/use-advice-job";

interface ActiveJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeJob: AdviceJob | null;
}

export function ActiveJobDialog({ open, onOpenChange, activeJob }: ActiveJobDialogProps) {
  const router = useRouter();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-mono">
            Generation in progress
          </AlertDialogTitle>
          <AlertDialogDescription>
            An advisor report for{" "}
            <span className="font-mono font-medium text-foreground">
              @{activeJob?.analyzed_username}
            </span>{" "}
            is currently being generated. Please wait for it to finish before
            starting a new one.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel size="sm" className="font-mono text-xs">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            size="sm"
            className="bg-emerald-500 text-background hover:bg-emerald-500/90 font-mono text-xs"
            onClick={() => {
              if (activeJob) {
                router.push(`/advisor/generate/${activeJob.analyzed_username}?jobId=${activeJob.id}`);
              }
            }}
          >
            <Loader2 className="size-3.5 animate-spin" />
            View Progress
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

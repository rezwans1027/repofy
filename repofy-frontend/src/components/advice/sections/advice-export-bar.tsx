"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Coins, FileDown, Lightbulb, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCreditBalance } from "@/hooks/use-credits";
import { exportToPdf } from "@/lib/export-pdf";
import { EASE_OUT_EXPO } from "@/lib/animation-variants";
import Link from "next/link";

interface AdviceExportBarProps {
  username: string;
  adviceRef: React.RefObject<HTMLDivElement | null>;
  onBeforeExport: () => void;
  onAfterExport: () => void;
}

export function AdviceExportBar({ username, adviceRef, onBeforeExport, onAfterExport }: AdviceExportBarProps) {
  const router = useRouter();
  const { data: balance } = useCreditBalance();
  const [isExporting, setIsExporting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState<"confirm_credit" | "no_credits" | null>(null);

  const handleRunAgain = () => {
    if (balance && balance.growth_balance === 0) {
      setDialogOpen("no_credits");
    } else {
      setDialogOpen("confirm_credit");
    }
  };

  const handleExportPDF = async () => {
    if (isExporting) return;

    setIsExporting(true);
    onBeforeExport();

    try {
      // Wait for the off-screen PDF layout to mount
      await new Promise((r) => setTimeout(r, 300));
      if (!adviceRef.current) return;
      const date = new Date().toISOString().split("T")[0];
      await exportToPdf(adviceRef.current, `repofy-advice-${username}-${date}.pdf`);
    } catch (err) {
      console.error("PDF export failed:", err);
    } finally {
      onAfterExport();
      setIsExporting(false);
    }
  };

  return (
    <>
      {/* Fixed bottom bar — slides up on mount */}
      <motion.div
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.6, ease: EASE_OUT_EXPO }}
        className="fixed bottom-0 left-0 right-0 lg:left-48 z-50 border-t border-border bg-background/80 backdrop-blur-md"
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <p className="hidden font-mono text-xs text-muted-foreground sm:block">
            Advice for{" "}
            <span className="text-emerald-400">@{username}</span>
          </p>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              size="sm"
              variant="outline"
              className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-400 font-mono text-xs flex-1 sm:flex-initial"
              onClick={handleRunAgain}
            >
              <RefreshCw className="size-3.5" />
              Run Again
            </Button>
            <Button
              size="sm"
              className="bg-emerald-500 text-background hover:bg-emerald-500/90 font-mono text-xs flex-1 sm:flex-initial"
              onClick={handleExportPDF}
              disabled={isExporting}
            >
              {isExporting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <FileDown className="size-3.5" />
              )}
              {isExporting ? "Exporting..." : "Export PDF"}
            </Button>
          </div>
        </div>
      </motion.div>

      {createPortal(
        <AnimatePresence>
          {dialogOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center">
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={() => setDialogOpen(null)}
              />

              {/* Dialog */}
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 10, filter: "blur(4px)" }}
                animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, scale: 0.95, y: 5, filter: "blur(2px)" }}
                transition={{ duration: 0.25, ease: EASE_OUT_EXPO }}
                className="relative w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-2xl"
              >
                {dialogOpen === "no_credits" ? (
                  <>
                    <h2 className="font-mono text-lg font-semibold">No growth credits</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      You need at least 1 growth credit to regenerate advice. Purchase credits to continue.
                    </p>
                    <div className="mt-6 flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="font-mono text-xs"
                        onClick={() => setDialogOpen(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        className="bg-cyan text-background hover:bg-cyan/90 font-mono text-xs"
                        asChild
                      >
                        <Link href="/pricing">
                          <Coins className="size-3.5" />
                          Buy Credits
                        </Link>
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <h2 className="font-mono text-lg font-semibold">Use 1 growth credit</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Regenerating advice for <span className="font-mono font-medium text-foreground">@{username}</span> will use <span className="font-mono font-medium text-emerald-400">1 growth credit</span> and replace the current advice. You currently have <span className="font-mono font-medium text-foreground">{balance?.growth_balance ?? 0}</span> credit{balance?.growth_balance !== 1 ? "s" : ""}.
                    </p>
                    <div className="mt-6 flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="font-mono text-xs"
                        onClick={() => setDialogOpen(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        className="bg-emerald-500 text-background hover:bg-emerald-500/90 font-mono text-xs"
                        onClick={() => {
                          setDialogOpen(null);
                          router.push(`/advisor/generate/${username}`);
                        }}
                      >
                        <Lightbulb className="size-3.5" />
                        Continue
                      </Button>
                    </div>
                  </>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}

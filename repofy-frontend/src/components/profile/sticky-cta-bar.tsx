"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/lib/supabase/client";

interface StickyCTABarProps {
  username: string;
  delay?: number;
}

export function StickyCTABar({ username, delay = 50 }: StickyCTABarProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  const handleClick = async () => {
    if (!user) {
      router.push(`/generate/${username}`);
      return;
    }

    const supabase = createClient();
    const { data } = await supabase
      .from("reports")
      .select("id")
      .eq("user_id", user.id)
      .eq("analyzed_username", username)
      .limit(1);

    if (data && data.length > 0) {
      setDialogOpen(true);
    } else {
      router.push(`/generate/${username}`);
    }
  };

  return (
    <>
      <div
        className={`fixed bottom-0 left-0 right-0 lg:left-48 z-50 border-t border-border bg-background/80 backdrop-blur-md transition-all duration-500 ${show ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"}`}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="hidden sm:block">
            <p className="font-mono text-sm font-bold">
              Analyze <span className="text-cyan">@{username}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Generate a hiring-grade developer evaluation
            </p>
          </div>
          <Button
            size="lg"
            className="bg-cyan text-background hover:bg-cyan/90 font-mono text-sm px-8 w-full sm:w-auto"
            onClick={handleClick}
          >
            <Sparkles className="size-4" />
            Start Analysis
          </Button>
        </div>
      </div>

      {createPortal(
        <AnimatePresence>
          {dialogOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-0 bg-black/50"
                onClick={() => setDialogOpen(false)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="relative w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-lg"
              >
                <h2 className="font-mono text-lg font-semibold">Report already exists</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  A report for <span className="font-mono font-medium text-foreground">@{username}</span> already exists. Generate a new report and replace the old one?
                </p>
                <div className="mt-6 flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="font-mono text-xs"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="bg-cyan text-background hover:bg-cyan/90 font-mono text-xs"
                    onClick={() => {
                      setDialogOpen(false);
                      router.push(`/generate/${username}`);
                    }}
                  >
                    Replace report
                  </Button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}

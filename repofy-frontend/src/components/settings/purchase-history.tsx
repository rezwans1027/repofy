"use client";

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useCreditHistory, type CreditTransaction } from "@/hooks/use-credits";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditCard, ArrowDownCircle, ArrowUpCircle, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import { tabContentVariants, staggerContainerFast, staggerItem } from "@/lib/animation-variants";

const PAGE_SIZE = 5;

function sourceIcon(source: string) {
  switch (source) {
    case "purchase":
    case "stripe":
      return <CreditCard className="h-3.5 w-3.5 text-emerald-400" />;
    case "refund":
      return <RotateCcw className="h-3.5 w-3.5 text-blue-400" />;
    case "deduction":
    case "usage":
      return <ArrowUpCircle className="h-3.5 w-3.5 text-orange-400" />;
    default:
      return <ArrowDownCircle className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

function amountColor(amount: number, source: string) {
  if (source === "refund") return "text-blue-400";
  return amount > 0 ? "text-emerald-400" : "text-orange-400";
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function TransactionRowContent({ tx }: { tx: CreditTransaction }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="shrink-0">{sourceIcon(tx.source)}</div>
      <div className="min-w-0 flex-1">
        <p className="font-mono text-xs text-foreground truncate">
          {tx.description || `${tx.credit_type} — ${tx.source}`}
        </p>
        <p className="font-mono text-[10px] text-muted-foreground">
          {formatDate(tx.created_at)}
        </p>
      </div>
      <span className={`font-mono text-xs font-bold shrink-0 ${amountColor(tx.amount, tx.source)}`}>
        {tx.amount > 0 ? "+" : ""}{tx.amount}
      </span>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-2.5">
          <Skeleton className="h-3.5 w-3.5 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-2.5 w-1/3" />
          </div>
          <Skeleton className="h-3 w-8" />
        </div>
      ))}
    </div>
  );
}

export function PurchaseHistory() {
  const [page, setPage] = useState(0);
  const [direction, setDirection] = useState<number | null>(null);
  const prefersReducedMotion = useReducedMotion();

  const offset = page * PAGE_SIZE;
  const { data, isLoading, isFetching, isPending } = useCreditHistory(PAGE_SIZE, offset);

  const transactions = data?.transactions ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasPrev = page > 0;
  const hasNext = page < totalPages - 1;

  // Only animate when data for the new page has actually arrived.
  // Derive the key from the first transaction id so AnimatePresence
  // only swaps when we have genuinely different content to show.
  const dataKey = transactions[0]?.id ?? `empty-${page}`;

  function goTo(newPage: number) {
    setDirection(newPage > page ? 1 : -1);
    setPage(newPage);
  }

  // Show skeleton while loading OR while waiting for auth (query disabled → isPending but not isLoading)
  if (isLoading || (!data && isPending)) return <SkeletonRows />;

  if (transactions.length === 0 && page === 0) {
    return (
      <p className="font-mono text-xs text-muted-foreground py-2">No transactions yet</p>
    );
  }

  const animate = !prefersReducedMotion;

  return (
    <div className="space-y-3">
      {/* Transaction list — same AnimatePresence pattern as advisor tabs */}
      <div className="relative min-h-[180px]">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={dataKey}
            custom={direction}
            variants={animate ? tabContentVariants : undefined}
            initial={animate ? "enter" : false}
            animate={animate ? "center" : undefined}
            exit={animate ? "exit" : undefined}
          >
            <motion.div
              className="divide-y divide-border"
              variants={animate ? staggerContainerFast : undefined}
              initial={animate ? "hidden" : false}
              animate={animate ? "visible" : undefined}
            >
              {transactions.map((tx) =>
                animate ? (
                  <motion.div key={tx.id} variants={staggerItem}>
                    <TransactionRowContent tx={tx} />
                  </motion.div>
                ) : (
                  <TransactionRowContent key={tx.id} tx={tx} />
                ),
              )}
            </motion.div>
          </motion.div>
        </AnimatePresence>

        {/* Subtle loading overlay during page fetch */}
        <AnimatePresence>
          {isFetching && (
            <motion.div
              className="absolute inset-0 bg-card/60 rounded"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Pagination controls */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between border-t border-border pt-3">
          <Button
            size="xs"
            variant="ghost"
            onClick={() => goTo(page - 1)}
            disabled={!hasPrev || isFetching}
            className="font-mono text-[10px] text-muted-foreground gap-1"
          >
            <ChevronLeft className="h-3 w-3" />
            Prev
          </Button>

          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                disabled={isFetching}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === page
                    ? "w-4 bg-cyan-400"
                    : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                }`}
              />
            ))}
          </div>

          <Button
            size="xs"
            variant="ghost"
            onClick={() => goTo(page + 1)}
            disabled={!hasNext || isFetching}
            className="font-mono text-[10px] text-muted-foreground gap-1"
          >
            Next
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}

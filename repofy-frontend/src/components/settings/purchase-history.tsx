"use client";

import { useState } from "react";
import { useCreditHistory, type CreditTransaction } from "@/hooks/use-credits";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditCard, ArrowDownCircle, ArrowUpCircle, RotateCcw } from "lucide-react";

const PAGE_SIZE = 10;

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

function TransactionRow({ tx }: { tx: CreditTransaction }) {
  return (
    <div className="flex items-center gap-3 py-2">
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
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-3.5 w-3.5 rounded-full" />
          <div className="flex-1 space-y-1">
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
  const [offset, setOffset] = useState(0);
  const { data, isLoading } = useCreditHistory(PAGE_SIZE, offset);

  const transactions = data?.transactions ?? [];
  const total = data?.total ?? 0;
  const hasMore = offset + PAGE_SIZE < total;

  return (
    <div className="space-y-3">
      {isLoading ? (
        <SkeletonRows />
      ) : transactions.length === 0 ? (
        <p className="font-mono text-xs text-muted-foreground">No transactions yet</p>
      ) : (
        <>
          <div className="divide-y divide-border">
            {transactions.map((tx) => (
              <TransactionRow key={tx.id} tx={tx} />
            ))}
          </div>
          <div className="flex items-center justify-between pt-1">
            {offset > 0 && (
              <Button
                size="xs"
                variant="ghost"
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                className="font-mono text-[10px] text-muted-foreground"
              >
                Previous
              </Button>
            )}
            <span className="font-mono text-[10px] text-muted-foreground ml-auto">
              {Math.min(offset + PAGE_SIZE, total)} of {total}
            </span>
            {hasMore && (
              <Button
                size="xs"
                variant="ghost"
                onClick={() => setOffset(offset + PAGE_SIZE)}
                className="font-mono text-[10px] text-muted-foreground ml-2"
              >
                Show more
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

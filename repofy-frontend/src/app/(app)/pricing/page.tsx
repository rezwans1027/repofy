"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { AnimateOnView } from "@/components/ui/animate-on-view";
import { useCreditBalance, useAwaitCreditUpdate } from "@/hooks/use-credits";
import { api } from "@/lib/api-client";
import { Check, CreditCard, Loader2, Users, X, Coins } from "lucide-react";

const DEVELOPER_FEATURES = [
  "2 growth credits per purchase",
  "1 credit per AI-powered advice session",
  "Full GitHub profile analysis",
  "AI-powered skill radar",
  "Personalized improvement advice",
];

function PricingContent() {
  const searchParams = useSearchParams();
  const success = searchParams.get("success") === "true";
  const canceled = searchParams.get("canceled") === "true";
  const queryClient = useQueryClient();
  const { data: balance } = useCreditBalance();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Capture balance at time of success redirect so we can detect when it increases
  const balanceAtCheckout = useRef<number | undefined>(undefined);
  const [creditsReceived, setCreditsReceived] = useState(false);

  useEffect(() => {
    if (success && balance && balanceAtCheckout.current === undefined) {
      balanceAtCheckout.current = balance.growth_balance;
    }
  }, [success, balance]);

  // Poll for balance update after successful checkout
  const { data: polledBalance } = useAwaitCreditUpdate(
    success && !creditsReceived,
    balanceAtCheckout.current,
  );

  // When polled balance shows increase, sync it to the main query cache
  useEffect(() => {
    if (
      polledBalance &&
      balanceAtCheckout.current !== undefined &&
      polledBalance.growth_balance > balanceAtCheckout.current
    ) {
      setCreditsReceived(true);
      queryClient.setQueryData(["credits", "balance"], polledBalance);
    }
  }, [polledBalance, queryClient]);

  async function handleCheckout() {
    setLoading(true);
    setError(null);
    try {
      const { url } = await api.post<{ url: string }>(
        "/stripe/create-checkout-session",
        { auth: true },
      );
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <AnimateOnView>
        <div className="mb-2">
          <h2 className="font-mono text-base font-bold tracking-tight sm:text-lg">
            Pricing
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Choose the plan that fits your needs.
          </p>
        </div>
      </AnimateOnView>

      {/* Credit balance */}
      {balance && (
        <AnimateOnView delay={0.03}>
          <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
            <Coins className="size-4 text-cyan" />
            <p className="font-mono text-xs">
              You have <span className="font-bold text-cyan">{balance.growth_balance}</span> growth credit{balance.growth_balance !== 1 ? "s" : ""}
            </p>
          </div>
        </AnimateOnView>
      )}

      {/* Success banner */}
      {success && (
        <AnimateOnView delay={0.05}>
          {creditsReceived ? (
            <div className="flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
              <Check className="size-4 text-emerald-400" />
              <p className="font-mono text-xs text-emerald-400">
                2 growth credits added! Thank you for your purchase.
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-lg border border-cyan/30 bg-cyan/10 px-4 py-3">
              <Loader2 className="size-4 animate-spin text-cyan" />
              <p className="font-mono text-xs text-cyan">
                Payment received! Processing your credits&hellip;
              </p>
            </div>
          )}
        </AnimateOnView>
      )}

      {/* Canceled banner */}
      {canceled && (
        <AnimateOnView delay={0.05}>
          <div className="flex items-center gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3">
            <X className="size-4 text-yellow-400" />
            <p className="font-mono text-xs text-yellow-400">
              Payment canceled. No charges were made.
            </p>
          </div>
        </AnimateOnView>
      )}

      {/* Pricing cards */}
      <div className="grid gap-6 sm:grid-cols-2">
        {/* Developers card */}
        <AnimateOnView delay={0.1}>
          <div className="flex h-full flex-col rounded-lg border border-border bg-card p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-md bg-cyan/10">
                <CreditCard className="size-4 text-cyan" />
              </div>
              <div>
                <h3 className="font-mono text-sm font-bold">Developers</h3>
                <p className="text-xs text-muted-foreground">
                  One-time payment
                </p>
              </div>
            </div>

            <div className="mb-6">
              <span className="font-mono text-3xl font-bold">$5</span>
              <span className="ml-1 text-xs text-muted-foreground">USD</span>
            </div>

            <ul className="mb-6 flex-1 space-y-2">
              {DEVELOPER_FEATURES.map((feature) => (
                <li
                  key={feature}
                  className="flex items-start gap-2 text-xs text-muted-foreground"
                >
                  <Check className="mt-0.5 size-3 shrink-0 text-cyan" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            {error && (
              <p className="mb-3 font-mono text-xs text-destructive">
                {error}
              </p>
            )}

            <button
              onClick={handleCheckout}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-cyan px-4 py-2.5 font-mono text-xs font-medium text-white transition-colors hover:bg-cyan/90 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Redirecting…
                </>
              ) : (
                "Get Started — $5"
              )}
            </button>
          </div>
        </AnimateOnView>

        {/* Recruiters card */}
        <AnimateOnView delay={0.15}>
          <div className="flex h-full flex-col rounded-lg border border-border bg-card p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-md bg-secondary">
                <Users className="size-4 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-mono text-sm font-bold">Recruiters</h3>
                <p className="text-xs text-muted-foreground">
                  For hiring teams
                </p>
              </div>
            </div>

            <div className="mb-6">
              <span className="font-mono text-3xl font-bold text-muted-foreground">
                —
              </span>
            </div>

            <p className="mb-6 flex-1 text-xs text-muted-foreground">
              Bulk candidate analysis, team dashboards, ATS integration, and
              more. We&apos;re building something great for recruiters.
            </p>

            <div className="flex w-full items-center justify-center rounded-md border border-border bg-secondary/50 px-4 py-2.5 font-mono text-xs text-muted-foreground">
              Coming Soon
            </div>
          </div>
        </AnimateOnView>
      </div>
    </div>
  );
}

export default function PricingPage() {
  return (
    <Suspense>
      <PricingContent />
    </Suspense>
  );
}

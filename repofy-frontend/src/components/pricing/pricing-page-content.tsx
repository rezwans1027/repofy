"use client";

import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CREDIT_PACK_PRICE } from "@/lib/constants";
import { AnimateOnView } from "@/components/ui/animate-on-view";
import { useAuth } from "@/components/providers/auth-provider";
import { useCreditBalance, useAwaitCreditUpdate } from "@/hooks/use-credits";
import { api } from "@/lib/api-client";
import {
  Check,
  CreditCard,
  Loader2,
  Users,
  Coins,
  Zap,
  Shield,
  ArrowRight,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

const DEVELOPER_FEATURES = [
  { text: "2 growth credits per purchase", highlight: true },
  { text: "1 credit per AI-powered advice session", highlight: false },
  { text: "Full GitHub profile analysis", highlight: false },
  { text: "AI-powered skill radar", highlight: false },
  { text: "Personalized 12-week roadmap", highlight: false },
];

const RECRUITER_FEATURES = [
  "Bulk candidate analysis",
  "Team dashboards & analytics",
  "ATS integration",
  "Priority support",
];

export function PricingPageContent() {
  const queryClient = useQueryClient();
  const { isLoading: authLoading } = useAuth();
  const { data: balance, isLoading: balanceLoading } = useCreditBalance();
  const pageLoading = authLoading || balanceLoading;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [balanceAtCheckout, setBalanceAtCheckout] = useState<
    number | undefined
  >(undefined);
  const [creditsReceived, setCreditsReceived] = useState(false);
  const [waitingForCredits, setWaitingForCredits] = useState(false);

  // Timeout: stop polling after 30 seconds and show success anyway
  useEffect(() => {
    if (!waitingForCredits || creditsReceived) return;
    const timer = setTimeout(() => setCreditsReceived(true), 30_000);
    return () => clearTimeout(timer);
  }, [waitingForCredits, creditsReceived]);

  const { data: polledBalance } = useAwaitCreditUpdate(
    waitingForCredits && !creditsReceived,
    balanceAtCheckout,
  );

  useEffect(() => {
    if (waitingForCredits && !creditsReceived && balanceAtCheckout !== undefined) {
      const current = polledBalance ?? balance;
      if (current && current.growth_balance > balanceAtCheckout) {
        setCreditsReceived(true);
        setWaitingForCredits(false);
        setLoading(false);
        queryClient.setQueryData(["credits", "balance"], current);
      }
    }
  }, [waitingForCredits, creditsReceived, balanceAtCheckout, polledBalance, balance, queryClient]);

  async function handleCheckout() {
    setLoading(true);
    setError(null);
    try {
      const preBalance = balance?.growth_balance ?? 0;
      const { url } = await api.post<{ url: string }>(
        "/stripe/create-checkout-session",
        {},
      );
      if (!url.startsWith("https://checkout.stripe.com/")) {
        throw new Error("Invalid checkout URL");
      }
      setBalanceAtCheckout(preBalance);
      setCreditsReceived(false);
      setWaitingForCredits(true);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  if (pageLoading) {
    return (
      <div className="space-y-6">
        <div className="mb-2 space-y-2">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-3 w-56" />
        </div>
        <Skeleton className="h-11 w-full rounded-lg" />
        <div className="grid gap-6 sm:grid-cols-2">
          <Skeleton className="h-[400px] rounded-lg" />
          <Skeleton className="h-[400px] rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <AnimateOnView>
        <div className="mb-4">
          <h2 className="font-mono text-base font-bold tracking-tight sm:text-lg">
            Pricing
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Flexible plans to level up your developer profile.
          </p>
        </div>
      </AnimateOnView>

      {/* Credit balance */}
      <AnimateOnView delay={0.03}>
        <div className="inline-flex items-center gap-2.5 rounded-lg border border-border bg-card px-4 py-2.5">
          <div className="flex size-7 items-center justify-center rounded-full bg-emerald-500/10">
            <Coins className="size-3.5 text-emerald-400" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Your balance
            </span>
            <span className="font-mono text-sm font-bold">
              <span className="text-emerald-400">
                {balance?.growth_balance ?? 0}
              </span>{" "}
              credit{balance?.growth_balance !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </AnimateOnView>

      {/* Status banners */}
      {(waitingForCredits || creditsReceived) && (
        <AnimateOnView delay={0.05}>
          {creditsReceived ? (
            <div className="flex items-center gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
                <Check className="size-3.5 text-emerald-400" />
              </div>
              <div>
                <p className="font-mono text-xs font-semibold text-emerald-400">
                  Credits added!
                </p>
                <p className="text-[11px] text-emerald-400/70">
                  2 growth credits are now in your account.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
                <Loader2 className="size-3.5 animate-spin text-emerald-400" />
              </div>
              <div>
                <p className="font-mono text-xs font-semibold text-emerald-400">
                  Checkout in progress...
                </p>
                <p className="text-[11px] text-emerald-400/70">
                  Complete payment in the new tab. Credits will appear here
                  automatically.
                </p>
              </div>
            </div>
          )}
        </AnimateOnView>
      )}

      {/* Pricing cards */}
      <div className="grid gap-6 sm:grid-cols-2">
        {/* Developer card — featured */}
        <AnimateOnView delay={0.1}>
          <div className="group relative flex h-full flex-col overflow-hidden rounded-lg border border-emerald-500/20 bg-card">
            {/* Subtle top glow */}
            <div className="pointer-events-none absolute -top-20 left-1/2 h-40 w-64 -translate-x-1/2 rounded-full bg-emerald-500/6 blur-3xl transition-[background-color] duration-500 group-hover:bg-emerald-500/10" />

            <div className="relative flex flex-1 flex-col p-6">
              {/* Card header */}
              <div className="mb-4 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-md bg-emerald-500/10 ring-1 ring-emerald-500/20">
                    <Zap className="size-4 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="font-mono text-sm font-bold">Developers</h3>
                    <p className="text-[11px] text-muted-foreground">
                      One-time purchase
                    </p>
                  </div>
                </div>
                <Badge className="border-emerald-500/20 bg-emerald-500/10 text-[10px] font-semibold text-emerald-400 hover:bg-emerald-500/10">
                  Popular
                </Badge>
              </div>

              {/* Price */}
              <div className="mb-5">
                <div className="flex items-baseline gap-1">
                  <span className="font-mono text-3xl font-extrabold tracking-tight">
                    ${CREDIT_PACK_PRICE}
                  </span>
                  <span className="text-xs text-muted-foreground">USD</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  for 2 growth credits
                </p>
              </div>

              {/* Divider */}
              <div className="mb-5 h-px bg-gradient-to-r from-border via-border to-transparent" />

              {/* Features */}
              <ul className="mb-6 flex-1 space-y-2.5">
                {DEVELOPER_FEATURES.map(({ text, highlight }) => (
                  <li key={text} className="flex items-start gap-2">
                    <div
                      className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full ${highlight ? "bg-emerald-500/15" : "bg-secondary"}`}
                    >
                      <Check
                        className={`size-2.5 ${highlight ? "text-emerald-400" : "text-muted-foreground"}`}
                      />
                    </div>
                    <span
                      className={`text-xs ${highlight ? "font-medium text-foreground" : "text-muted-foreground"}`}
                    >
                      {text}
                    </span>
                  </li>
                ))}
              </ul>

              {/* Error */}
              {error && (
                <p className="mb-3 font-mono text-xs text-destructive">
                  {error}
                </p>
              )}

              {/* CTA */}
              <button
                onClick={handleCheckout}
                disabled={loading}
                className="group/btn flex w-full items-center justify-center gap-2 rounded-md bg-emerald-500 px-4 py-2.5 font-mono text-xs font-semibold text-white shadow-sm shadow-emerald-500/20 transition-[box-shadow,filter] hover:shadow-md hover:shadow-emerald-500/25 hover:brightness-110 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Opening checkout...
                  </>
                ) : (
                  <>
                    Get Started
                    <ArrowRight className="size-3.5 transition-transform group-hover/btn:translate-x-0.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </AnimateOnView>

        {/* Recruiter card — coming soon */}
        <AnimateOnView delay={0.15}>
          <div className="flex h-full flex-col rounded-lg border border-border bg-card">
            <div className="flex flex-1 flex-col p-6">
              {/* Card header */}
              <div className="mb-4 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-md bg-secondary">
                    <Users className="size-4 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-mono text-sm font-bold">Recruiters</h3>
                    <p className="text-[11px] text-muted-foreground">
                      For hiring teams
                    </p>
                  </div>
                </div>
                <Badge
                  variant="secondary"
                  className="text-[10px] font-semibold"
                >
                  Soon
                </Badge>
              </div>

              {/* Price placeholder */}
              <div className="mb-5">
                <div className="flex items-baseline gap-1">
                  <span className="font-mono text-3xl font-extrabold tracking-tight text-muted-foreground/40">
                    ---
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  pricing to be announced
                </p>
              </div>

              {/* Divider */}
              <div className="mb-5 h-px bg-gradient-to-r from-border via-border to-transparent" />

              {/* Features */}
              <ul className="mb-6 flex-1 space-y-2.5">
                {RECRUITER_FEATURES.map((text) => (
                  <li key={text} className="flex items-start gap-2">
                    <div className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-secondary">
                      <Check className="size-2.5 text-muted-foreground/50" />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {text}
                    </span>
                  </li>
                ))}
              </ul>

              {/* CTA placeholder */}
              <div className="flex w-full items-center justify-center rounded-md border border-border bg-secondary/50 px-4 py-2.5 font-mono text-xs text-muted-foreground">
                Coming Soon
              </div>
            </div>
          </div>
        </AnimateOnView>
      </div>

      {/* Trust bar */}
      <AnimateOnView delay={0.2}>
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Shield className="size-3" />
            <span>Secure checkout via Stripe</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <CreditCard className="size-3" />
            <span>No subscription required</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Zap className="size-3" />
            <span>Credits never expire</span>
          </div>
        </div>
      </AnimateOnView>
    </div>
  );
}

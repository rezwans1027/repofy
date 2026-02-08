"use client";

import Link from "next/link";
import { SectionHeader } from "@/components/ui/section-header";
import { AnimateOnView } from "@/components/ui/animate-on-view";
import { TerminalWindow } from "@/components/ui/terminal-window";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";

const plans = [
  {
    name: "Beta",
    price: "Free",
    period: "during beta",
    description: "Everything. No limits. No catch.",
    features: [
      "AI developer analysis",
      "AI profile advisor with action plans",
      "Side-by-side candidate comparison",
      "6-axis Developer DNA radar chart",
      "Per-repo code quality grades",
      "Strengths, red flags & interview questions",
      "PDF export for reports, advice & comparisons",
      "Reports dashboard with search & filters",
    ],
    cta: "Get Started Free",
    highlighted: true,
    comingSoon: false,
  },
  {
    name: "Pipeline",
    price: "$29",
    period: "/mo",
    description: "For teams who hire at scale.",
    features: [
      "Everything in Beta",
      "Team dashboard & shared reports",
      "API access for integrations",
      "Custom evaluation criteria",
      "Candidate pipeline management",
      "Priority support",
    ],
    cta: "Coming Soon",
    highlighted: false,
    comingSoon: true,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="py-20">
      <AnimateOnView>
        <SectionHeader
          title="Pricing"
          subtitle="Free while in beta. Full access. No credit card required."
        />
      </AnimateOnView>

      <div className="grid gap-6 md:grid-cols-2">
        {plans.map((plan, i) => (
          <AnimateOnView key={plan.name} delay={0.1 * i}>
            <TerminalWindow
              title={plan.name.toLowerCase()}
              className={
                plan.highlighted ? "border-cyan/30 ring-1 ring-cyan/20" : ""
              }
            >
              <div className="space-y-4">
                <div className="flex items-baseline gap-1">
                  <span className="font-mono text-3xl font-bold text-foreground">
                    {plan.price}
                  </span>
                  <span className="text-muted-foreground font-mono text-sm">
                    {plan.period}
                  </span>
                  {plan.highlighted && (
                    <Badge className="bg-cyan/10 text-cyan border-cyan/20 ml-2 font-mono text-[10px]">
                      Current
                    </Badge>
                  )}
                  {plan.comingSoon && (
                    <Badge variant="outline" className="ml-2 font-mono text-[10px]">
                      Coming Soon
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground text-sm">
                  {plan.description}
                </p>
                <ul className="space-y-2">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-center gap-2 text-sm"
                    >
                      <span className="text-cyan font-mono text-xs">+</span>
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
                {plan.highlighted ? (
                  <Button
                    className="w-full bg-cyan text-background hover:bg-cyan/90 font-mono"
                    asChild
                  >
                    <Link href="/login">
                      {plan.cta}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                ) : (
                  <Button
                    className="w-full font-mono"
                    variant="outline"
                    disabled
                  >
                    {plan.cta}
                  </Button>
                )}
              </div>
            </TerminalWindow>
          </AnimateOnView>
        ))}
      </div>
    </section>
  );
}

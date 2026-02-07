"use client";

import { SectionHeader } from "@/components/ui/section-header";
import { AnimateOnView } from "@/components/ui/animate-on-view";
import { TerminalWindow } from "@/components/ui/terminal-window";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const plans = [
  {
    name: "Single Report",
    price: "$9",
    period: "one-time",
    description: "One developer evaluation. Full analysis.",
    features: [
      "Complete code DNA analysis",
      "Language fingerprint breakdown",
      "Commit pattern analysis",
      "PDF export",
    ],
    cta: "Generate Report",
    highlighted: false,
  },
  {
    name: "Pipeline",
    price: "$49",
    period: "/mo",
    description: "Unlimited reports. Built for teams that hire.",
    features: [
      "Everything in Single Report",
      "Unlimited evaluations",
      "Team dashboard",
      "API access",
      "Candidate comparison",
    ],
    cta: "Start Pipeline",
    highlighted: true,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="py-20">
      <AnimateOnView>
        <SectionHeader
          title="Pricing"
          subtitle="No free tier. No bait. You pay for signal."
        />
      </AnimateOnView>

      <div className="grid gap-6 md:grid-cols-2">
        {plans.map((plan, i) => (
          <AnimateOnView key={plan.name} delay={0.1 * i}>
            <TerminalWindow
              title={plan.name.toLowerCase().replace(" ", "-")}
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
                      Popular
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
                <Button
                  className={
                    plan.highlighted
                      ? "w-full bg-cyan text-background hover:bg-cyan/90 font-mono"
                      : "w-full font-mono"
                  }
                  variant={plan.highlighted ? "default" : "outline"}
                >
                  {plan.cta}
                </Button>
              </div>
            </TerminalWindow>
          </AnimateOnView>
        ))}
      </div>
    </section>
  );
}

import Link from "next/link";
import { CREDIT_PACK_PRICE, CREDIT_PACK_SIZE } from "@/lib/constants";
import { SectionHeader } from "@/components/ui/section-header";
import { AnimateOnView } from "@/components/ui/animate-on-view";
import { TerminalWindow } from "@/components/ui/terminal-window";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";

const plans = [
  {
    name: "Explorer",
    price: "Free",
    period: "to start",
    description: "Explore profiles for free. AI advisor sessions cost growth credits.",
    features: [
      "GitHub profile explorer with real stats",
      "Top repos, languages & activity feed",
      "Contribution heatmap & history",
      `AI Profile Advisor — $${CREDIT_PACK_PRICE} for ${CREDIT_PACK_SIZE} growth credits`,
      "Personalized project ideas & 12-week roadmap",
      "PDF export for advice plans",
    ],
    cta: "Get Started Free",
    highlighted: true,
    comingSoon: false,
  },
  {
    name: "Pipeline",
    price: "TBD",
    period: "",
    description: "For teams who hire at scale.",
    features: [
      "Everything in Explorer",
      "AI developer analysis with scored reports",
      "6-axis Developer DNA radar chart",
      "Side-by-side candidate comparison",
      "Evals dashboard with search & filters",
      "Team dashboard & shared reports",
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
          subtitle={`Explore profiles for free. Advisor credits start at $${CREDIT_PACK_PRICE}.`}
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
                {plan.highlighted && (
                  <div className="rounded-md border border-cyan/20 bg-cyan/5 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-muted-foreground">
                        AI Advisor session
                      </span>
                      <span className="font-mono text-sm font-bold text-cyan">
                        1 credit
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="font-mono text-xs text-muted-foreground">
                        Credit pack
                      </span>
                      <span className="font-mono text-sm font-bold text-foreground">
                        ${CREDIT_PACK_PRICE} <span className="text-muted-foreground text-xs font-normal">/ {CREDIT_PACK_SIZE} credits</span>
                      </span>
                    </div>
                  </div>
                )}
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

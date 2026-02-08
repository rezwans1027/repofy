"use client";

import Link from "next/link";
import { AnimateOnView } from "@/components/ui/animate-on-view";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function FinalCta() {
  return (
    <section className="py-20">
      <AnimateOnView>
        <div className="rounded-lg border border-cyan/20 bg-cyan/5 p-8 text-center sm:p-12">
          <h2 className="font-mono text-xl font-bold sm:text-2xl">
            Start analyzing.{" "}
            <span className="text-cyan">It&apos;s free.</span>
          </h2>
          <p className="text-muted-foreground mx-auto mt-3 max-w-md text-sm">
            Paste any GitHub username and get a full developer evaluation in
            seconds. No credit card. No signup fees. Full access during beta.
          </p>
          <div className="mt-6">
            <Button
              size="lg"
              className="bg-cyan text-background hover:bg-cyan/90 font-mono text-sm"
              asChild
            >
              <Link href="/login">
                Get Started Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </AnimateOnView>
    </section>
  );
}

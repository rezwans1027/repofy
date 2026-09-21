"use client";
import { Button } from "@/components/ui/button";
export default function ReadinessError({ reset }: { reset: () => void }) {
  return <section role="alert" className="space-y-4"><h1 className="text-2xl font-semibold">Readiness could not be loaded</h1><p>Your saved data has not changed.</p><Button onClick={reset}>Try again</Button></section>;
}

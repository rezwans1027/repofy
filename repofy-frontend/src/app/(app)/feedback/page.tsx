import type { Metadata } from "next";
import { AnimateOnView } from "@/components/ui/animate-on-view";
import { FeedbackForm } from "@/components/feedback/feedback-form";

export const metadata: Metadata = {
  title: "Feedback",
  description: "Submit feedback, report bugs, or request new features for Repofy.",
};

export default function FeedbackPage() {
  return (
    <div className="space-y-10">
      <AnimateOnView delay={0}>
        <div className="mb-4">
          <h2 className="font-mono text-base font-bold tracking-tight sm:text-lg">
            Feedback
          </h2>
          <p className="text-muted-foreground mt-1 text-xs">
            Report a bug, request a feature, or share your thoughts
          </p>
        </div>
      </AnimateOnView>

      <AnimateOnView delay={0.05}>
        <FeedbackForm />
      </AnimateOnView>
    </div>
  );
}

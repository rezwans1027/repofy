"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Bug, Lightbulb, MessageSquare, Loader2 } from "lucide-react";

function AnimatedCheck() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 52 52"
      className="mx-auto h-12 w-12 text-primary"
    >
      <motion.circle
        cx="26"
        cy="26"
        r="24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      />
      <motion.path
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14.1 27.2l7.1 7.2 16.7-16.8"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.35, delay: 0.35, ease: "easeOut" }}
      />
    </svg>
  );
}

const CATEGORIES = [
  { value: "bug", label: "Bug Report", icon: Bug, description: "Something isn't working" },
  { value: "feature", label: "Feature Request", icon: Lightbulb, description: "Suggest an improvement" },
  { value: "feedback", label: "General Feedback", icon: MessageSquare, description: "Share your thoughts" },
] as const;

type Category = (typeof CATEGORIES)[number]["value"];

export function FeedbackForm() {
  const [category, setCategory] = useState<Category | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const selectedCategory = CATEGORIES.find((item) => item.value === category) ?? null;

  const canSubmit = category && message.trim().length >= 10 && !loading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    try {
      await api.post("/feedback", {
        body: { category, message: message.trim() },
      });
      setSubmitted(true);
    } catch {
      // Error handled by api-client
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setCategory(null);
    setMessage("");
    setSubmitted(false);
  }

  return (
    <AnimatePresence mode="wait">
      {submitted ? (
        <motion.div
          key="confirmation"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="rounded-lg border border-border bg-card p-8 text-center space-y-4"
        >
          <AnimatedCheck />
          <motion.div
            className="space-y-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.3 }}
          >
            <h3 className="font-mono text-sm font-bold">Thank you!</h3>
            <p className="text-xs text-muted-foreground">
              Your feedback has been submitted. We appreciate you taking the time to help us improve.
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.65, duration: 0.3 }}
          >
            <Button
              size="sm"
              variant="outline"
              onClick={handleReset}
              className="font-mono text-xs"
            >
              Submit another
            </Button>
          </motion.div>
        </motion.div>
      ) : (
        <motion.form
          key="form"
          onSubmit={handleSubmit}
          className="space-y-6"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          {/* Category selector */}
          <fieldset className="rounded-lg border border-border bg-card p-6 space-y-4">
            <div className="space-y-1">
              <legend className="font-mono text-sm font-bold">What kind of feedback?</legend>
              <p className="font-mono text-[10px] text-muted-foreground">
                {selectedCategory
                  ? `Selected: ${selectedCategory.label}`
                  : "Select Bug Report, Feature Request, or General Feedback before submitting."}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const selected = category === cat.value;
                return (
                  <label
                    key={cat.value}
                    htmlFor={`feedback-category-${cat.value}`}
                    className={`group flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-all duration-200 ${
                      selected
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card hover:border-primary/40 hover:bg-primary/[0.02]"
                    }`}
                  >
                    <input
                      id={`feedback-category-${cat.value}`}
                      type="radio"
                      name="feedback-category"
                      value={cat.value}
                      aria-label={cat.label}
                      checked={selected}
                      onChange={() => setCategory(cat.value)}
                      className="sr-only"
                    />
                    <Icon
                      className={`h-5 w-5 transition-colors ${
                        selected ? "text-primary" : "text-muted-foreground group-hover:text-primary/60"
                      }`}
                    />
                    <span className="font-mono text-xs font-bold">{cat.label}</span>
                    <span className="text-[10px] text-muted-foreground">{cat.description}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {/* Message */}
          <div className="rounded-lg border border-border bg-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-mono text-sm font-bold">Your message</h3>
              <span className="font-mono text-[10px] text-muted-foreground">
                {message.length}/2000
              </span>
            </div>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 2000))}
              placeholder={
                category === "bug"
                  ? "Describe the bug — what happened, what you expected, and steps to reproduce..."
                  : category === "feature"
                    ? "Describe the feature you'd like to see and how it would help you..."
                    : "Share your thoughts on Repofy..."
              }
              className="font-mono text-xs min-h-[140px] resize-y"
              required
            />
            {message.length > 0 && message.trim().length < 10 && (
              <p className="font-mono text-[10px] text-destructive">
                At least 10 characters required
              </p>
            )}
          </div>

          {/* Submit */}
          <div className="flex justify-end">
            <Button
              type="submit"
              size="sm"
              disabled={!canSubmit}
              className="font-mono text-xs gap-2"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                selectedCategory ? `Submit ${selectedCategory.label}` : "Submit Feedback"
              )}
            </Button>
          </div>
        </motion.form>
      )}
    </AnimatePresence>
  );
}

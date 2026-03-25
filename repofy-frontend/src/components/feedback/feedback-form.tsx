"use client";

import { useState, useEffect, useRef } from "react";
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

  const gridRef = useRef<HTMLDivElement>(null);
  const [indicatorRect, setIndicatorRect] = useState<{
    left: number; top: number; width: number; height: number;
  } | null>(null);

  const categoryIndex = category
    ? CATEGORIES.findIndex((c) => c.value === category)
    : -1;

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    function measure() {
      if (categoryIndex < 0) { setIndicatorRect(null); return; }
      const card = grid!.children[categoryIndex] as HTMLElement | undefined;
      if (!card) return;
      const gridBox = grid!.getBoundingClientRect();
      const cardBox = card.getBoundingClientRect();
      setIndicatorRect({
        left: cardBox.left - gridBox.left,
        top: cardBox.top - gridBox.top,
        width: cardBox.width,
        height: cardBox.height,
      });
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    return () => observer.disconnect();
  }, [categoryIndex]);

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
              <AnimatePresence mode="wait">
                <motion.p
                  key={category ?? "none"}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="font-mono text-[10px] text-muted-foreground"
                >
                  {selectedCategory
                    ? `Selected: ${selectedCategory.label}`
                    : "Select Bug Report, Feature Request, or General Feedback before submitting."}
                </motion.p>
              </AnimatePresence>
            </div>
            <div ref={gridRef} className="relative grid gap-3 sm:grid-cols-3">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const selected = category === cat.value;
                return (
                  <label
                    key={cat.value}
                    htmlFor={`feedback-category-${cat.value}`}
                    className="group relative flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-4 text-center cursor-pointer transition-colors duration-200 hover:border-primary/40 hover:bg-primary/[0.02]"
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
              {/* Sliding indicator — positioned at grid level to avoid card overflow clipping */}
              <AnimatePresence>
                {indicatorRect && (
                  <motion.div
                    key="feedback-indicator"
                    className="absolute rounded-lg border border-primary bg-primary/5 pointer-events-none"
                    initial={{ opacity: 0 }}
                    animate={{
                      opacity: 1,
                      left: indicatorRect.left,
                      top: indicatorRect.top,
                      width: indicatorRect.width,
                      height: indicatorRect.height,
                    }}
                    exit={{ opacity: 0 }}
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 30,
                      opacity: { duration: 0.15 },
                    }}
                  />
                )}
              </AnimatePresence>
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
              <AnimatePresence mode="wait" initial={false}>
                {loading ? (
                  <motion.span
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.1 }}
                  >
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  </motion.span>
                ) : (
                  <motion.span
                    key={category ?? "default"}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                  >
                    {selectedCategory ? `Submit ${selectedCategory.label}` : "Submit Feedback"}
                  </motion.span>
                )}
              </AnimatePresence>
            </Button>
          </div>
        </motion.form>
      )}
    </AnimatePresence>
  );
}

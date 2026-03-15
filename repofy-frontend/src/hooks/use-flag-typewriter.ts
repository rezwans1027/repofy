"use client";

import { useState, useEffect, useRef } from "react";

/**
 * Typewriter hook for a single flag string (e.g. " --verify").
 * Types forward when `active` is true, backspaces when false.
 * Returns `{ text, showCursor }`.
 */
export function useFlagTypewriter(flag: string, active: boolean) {
  const [text, setText] = useState("");
  const [showCursor, setShowCursor] = useState(false);
  const indexRef = useRef(0);

  useEffect(() => {
    if (active && indexRef.current < flag.length) {
      setShowCursor(true);
      const id = setInterval(() => {
        indexRef.current++;
        setText(flag.slice(0, indexRef.current));
        if (indexRef.current >= flag.length) {
          clearInterval(id);
          setTimeout(() => setShowCursor(false), 300);
        }
      }, 60);
      return () => clearInterval(id);
    } else if (!active && indexRef.current > 0) {
      setShowCursor(true);
      const id = setInterval(() => {
        indexRef.current--;
        setText(flag.slice(0, indexRef.current));
        if (indexRef.current <= 0) {
          clearInterval(id);
          setTimeout(() => setShowCursor(false), 300);
        }
      }, 40);
      return () => clearInterval(id);
    }
  }, [active, flag]);

  return { text, showCursor };
}

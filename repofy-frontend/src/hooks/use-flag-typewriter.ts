"use client";

import { useEffect, useState } from "react";

/**
 * Typewriter hook for a single flag string (e.g. " --verify").
 * Types forward when `active` is true, backspaces when false.
 * Returns `{ text, showCursor }`.
 */
export function useFlagTypewriter(flag: string, active: boolean) {
  const [text, setText] = useState("");

  useEffect(() => {
    if (active && text.length < flag.length) {
      const id = setInterval(() => {
        setText((current) => flag.slice(0, current.length + 1));
      }, 60);
      return () => clearInterval(id);
    }

    if (!active && text.length > 0) {
      const id = setInterval(() => {
        setText((current) => current.slice(0, -1));
      }, 40);
      return () => clearInterval(id);
    }
  }, [active, flag, text.length]);

  return {
    text,
    showCursor: active ? text.length < flag.length : text.length > 0,
  };
}

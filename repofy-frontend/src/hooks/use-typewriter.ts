"use client";

import { useState, useEffect, useRef, useReducer, useCallback } from "react";

type Phase = "typing" | "pausing" | "deleting";

export function useTypewriter(words: string[]) {
  const [placeholder, setPlaceholder] = useState("");
  const [, tick] = useReducer((c: number) => c + 1, 0);

  const wordIdx = useRef(0);
  const charIdx = useRef(0);
  const phase = useRef<Phase>("typing");

  const step = useCallback(() => {
    const word = words[wordIdx.current];

    switch (phase.current) {
      case "typing": {
        charIdx.current++;
        setPlaceholder(word.slice(0, charIdx.current));
        if (charIdx.current === word.length) {
          phase.current = "pausing";
        }
        break;
      }
      case "pausing": {
        phase.current = "deleting";
        tick();
        break;
      }
      case "deleting": {
        charIdx.current--;
        setPlaceholder(word.slice(0, charIdx.current));
        if (charIdx.current === 0) {
          wordIdx.current = (wordIdx.current + 1) % words.length;
          phase.current = "typing";
        }
        break;
      }
    }
  }, [words, tick]);

  useEffect(() => {
    const delay =
      phase.current === "pausing" ? 1500 : phase.current === "deleting" ? 50 : 60;

    const timeout = setTimeout(step, delay);
    return () => clearTimeout(timeout);
  });

  return placeholder;
}

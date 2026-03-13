"use client";

import { useState, useEffect } from "react";

export function useTypewriter(words: string[]) {
  const [placeholder, setPlaceholder] = useState("");
  const [usernameIndex, setUsernameIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentName = words[usernameIndex];

    const timeout = setTimeout(
      () => {
        if (!isDeleting) {
          setPlaceholder(currentName.slice(0, charIndex + 1));
          setCharIndex((c) => c + 1);

          if (charIndex + 1 === currentName.length) {
            setTimeout(() => setIsDeleting(true), 1500);
          }
        } else {
          setPlaceholder(currentName.slice(0, charIndex - 1));
          setCharIndex((c) => c - 1);

          if (charIndex <= 1) {
            setIsDeleting(false);
            setUsernameIndex((i) => (i + 1) % words.length);
            setCharIndex(0);
          }
        }
      },
      isDeleting ? 50 : 120
    );

    return () => clearTimeout(timeout);
  }, [charIndex, isDeleting, usernameIndex, words]);

  return placeholder;
}

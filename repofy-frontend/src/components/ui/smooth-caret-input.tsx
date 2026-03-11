"use client";

import { useState, useRef, useEffect, useCallback } from "react";

export function SmoothCaretInput({
  value,
  onChange,
  placeholder,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [caretLeft, setCaretLeft] = useState(0);
  const [focused, setFocused] = useState(false);

  const updateCaretPosition = useCallback(() => {
    const input = inputRef.current;
    const measure = measureRef.current;
    if (!input || !measure) return;

    const pos = input.selectionStart ?? 0;
    const textBeforeCaret = (input.value || "").slice(0, pos);
    measure.textContent = textBeforeCaret || "\u200b";
    setCaretLeft(textBeforeCaret ? measure.offsetWidth : 0);
  }, []);

  useEffect(() => {
    updateCaretPosition();
  }, [value, updateCaretPosition]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    const handler = () => updateCaretPosition();
    input.addEventListener("select", handler);
    input.addEventListener("click", handler);
    input.addEventListener("keyup", handler);
    return () => {
      input.removeEventListener("select", handler);
      input.removeEventListener("click", handler);
      input.removeEventListener("keyup", handler);
    };
  }, [updateCaretPosition]);

  return (
    <div className="relative">
      <span
        ref={measureRef}
        aria-hidden
        className="pointer-events-none invisible absolute left-0 top-0 whitespace-pre font-mono text-sm"
      />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => {
          onChange?.(e);
          requestAnimationFrame(updateCaretPosition);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={() => requestAnimationFrame(updateCaretPosition)}
        onClick={updateCaretPosition}
        placeholder={placeholder}
        className={`${className} caret-transparent`}
        {...props}
      />
      {focused && (
        <span
          className="pointer-events-none absolute top-1/2 h-[1.1em] w-[1.5px] -translate-y-1/2 bg-white animate-smooth-caret-blink"
          style={{
            left: caretLeft,
            transition: "left 80ms cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        />
      )}
    </div>
  );
}

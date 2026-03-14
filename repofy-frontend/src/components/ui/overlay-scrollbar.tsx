"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export function OverlayScrollbar() {
  const thumbRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  // Only thumbHeight=0 vs >0 matters for React rendering (conditional return).
  // All other scroll values live in refs and update the DOM directly to avoid
  // 3 state updates (~60/sec) on every scroll frame.
  const scrollValues = useRef({ thumbHeight: 0, thumbTop: 0, scrollPercent: 0 });
  const [showTrack, setShowTrack] = useState(false);
  const [visible, setVisible] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [hovering, setHovering] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const dragStartY = useRef(0);
  const dragStartScroll = useRef(0);
  const rafId = useRef(0);

  const update = useCallback(() => {
    const { scrollHeight, clientHeight, scrollTop } = document.documentElement;
    if (scrollHeight <= clientHeight) {
      if (scrollValues.current.thumbHeight !== 0) {
        scrollValues.current.thumbHeight = 0;
        setShowTrack(false);
      }
      return;
    }
    const ratio = clientHeight / scrollHeight;
    const height = Math.max(ratio * clientHeight, 30);
    const maxTop = clientHeight - height;
    const top = (scrollTop / (scrollHeight - clientHeight)) * maxTop;
    const percent = Math.round((scrollTop / (scrollHeight - clientHeight)) * 100);

    const wasZero = scrollValues.current.thumbHeight === 0;
    scrollValues.current.thumbHeight = height;
    scrollValues.current.thumbTop = top;
    scrollValues.current.scrollPercent = percent;

    if (wasZero) setShowTrack(true);

    // Direct DOM updates — no React re-renders
    const el = thumbRef.current;
    if (el) {
      el.style.height = `${height}px`;
      el.style.top = `${top}px`;
      el.setAttribute("aria-valuenow", String(percent));
    }
  }, []);

  const showTemporarily = useCallback(() => {
    setVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (!dragging && !hovering) setVisible(false);
    }, 1200);
  }, [dragging, hovering]);

  useEffect(() => {
    update();
    const onScroll = () => {
      cancelAnimationFrame(rafId.current);
      rafId.current = requestAnimationFrame(() => {
        update();
        showTemporarily();
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    return () => {
      cancelAnimationFrame(rafId.current);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", update);
    };
  }, [update, showTemporarily]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      setDragging(true);
      dragStartY.current = e.clientY;
      dragStartScroll.current = document.documentElement.scrollTop;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    []
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      const { scrollHeight, clientHeight } = document.documentElement;
      const maxTop = clientHeight - scrollValues.current.thumbHeight;
      const delta = e.clientY - dragStartY.current;
      const scrollDelta = (delta / maxTop) * (scrollHeight - clientHeight);
      window.scrollTo(0, dragStartScroll.current + scrollDelta);
    },
    [dragging]
  );

  const onPointerUp = useCallback(() => {
    setDragging(false);
    if (!hovering) {
      hideTimer.current = setTimeout(() => setVisible(false), 1200);
    }
  }, [hovering]);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    const step = 80;
    const pageStep = window.innerHeight * 0.8;
    const { scrollHeight, clientHeight } = document.documentElement;
    const max = scrollHeight - clientHeight;

    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        window.scrollBy(0, -step);
        break;
      case "ArrowDown":
        e.preventDefault();
        window.scrollBy(0, step);
        break;
      case "PageUp":
        e.preventDefault();
        window.scrollBy(0, -pageStep);
        break;
      case "PageDown":
        e.preventDefault();
        window.scrollBy(0, pageStep);
        break;
      case "Home":
        e.preventDefault();
        window.scrollTo(0, 0);
        break;
      case "End":
        e.preventDefault();
        window.scrollTo(0, max);
        break;
    }
  }, []);

  const onTrackClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target !== trackRef.current) return;
      const { scrollHeight, clientHeight } = document.documentElement;
      const rect = trackRef.current!.getBoundingClientRect();
      const ratio = (e.clientY - rect.top) / rect.height;
      window.scrollTo({
        top: ratio * (scrollHeight - clientHeight),
        behavior: "smooth",
      });
    },
    []
  );

  if (!showTrack) return null;

  return (
    <div
      ref={trackRef}
      className={`fixed top-0 right-0 bottom-0 z-[9999] w-3 ${visible || dragging ? "cursor-pointer" : "pointer-events-none"}`}
      onClick={onTrackClick}
      onMouseEnter={() => {
        setHovering(true);
        setVisible(true);
        if (hideTimer.current) clearTimeout(hideTimer.current);
      }}
      onMouseLeave={() => {
        setHovering(false);
        if (!dragging) {
          hideTimer.current = setTimeout(() => setVisible(false), 1200);
        }
      }}
    >
      <div
        ref={thumbRef}
        role="scrollbar"
        aria-controls="overlay-scrollbar-target"
        aria-orientation="vertical"
        aria-valuenow={0}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Page scroll"
        tabIndex={0}
        className="absolute right-0.5 w-1.5 rounded-full transition-opacity duration-300"
        style={{
          height: scrollValues.current.thumbHeight,
          top: scrollValues.current.thumbTop,
          opacity: visible || dragging ? 1 : 0,
          background: "color-mix(in srgb, var(--muted-foreground) 40%, transparent)",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onKeyDown={onKeyDown}
      />
    </div>
  );
}

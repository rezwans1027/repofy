"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function OverlayScrollbar() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState({
    height: 0,
    top: 0,
    percent: 0,
  });
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
      setThumb((current) => (
        current.height === 0
          ? current
          : { height: 0, top: 0, percent: 0 }
      ));
      setShowTrack(false);
      return;
    }
    const ratio = clientHeight / scrollHeight;
    const height = Math.max(ratio * clientHeight, 30);
    const maxTop = clientHeight - height;
    const top = (scrollTop / (scrollHeight - clientHeight)) * maxTop;
    const percent = Math.round((scrollTop / (scrollHeight - clientHeight)) * 100);
    setThumb({ height, top, percent });
    setShowTrack(true);
  }, []);

  const showTemporarily = useCallback(() => {
    setVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (!dragging && !hovering) setVisible(false);
    }, 1200);
  }, [dragging, hovering]);

  useEffect(() => {
    const frameId = requestAnimationFrame(update);
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
      cancelAnimationFrame(frameId);
      cancelAnimationFrame(rafId.current);
      if (hideTimer.current) clearTimeout(hideTimer.current);
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
      const maxTop = clientHeight - thumb.height;
      const delta = e.clientY - dragStartY.current;
      const scrollDelta = (delta / maxTop) * (scrollHeight - clientHeight);
      window.scrollTo(0, dragStartScroll.current + scrollDelta);
    },
    [dragging, thumb.height]
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
        role="scrollbar"
        aria-controls="overlay-scrollbar-target"
        aria-orientation="vertical"
        aria-valuenow={thumb.percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Page scroll"
        tabIndex={0}
        className="absolute right-0.5 w-1.5 rounded-full transition-opacity duration-300"
        style={{
          height: thumb.height,
          top: thumb.top,
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

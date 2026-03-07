"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export function OverlayScrollbar() {
  const thumbRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [thumbHeight, setThumbHeight] = useState(0);
  const [thumbTop, setThumbTop] = useState(0);
  const [visible, setVisible] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [hovering, setHovering] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const dragStartY = useRef(0);
  const dragStartScroll = useRef(0);

  const update = useCallback(() => {
    const { scrollHeight, clientHeight, scrollTop } = document.documentElement;
    if (scrollHeight <= clientHeight) {
      setThumbHeight(0);
      return;
    }
    const ratio = clientHeight / scrollHeight;
    const height = Math.max(ratio * clientHeight, 30);
    const maxTop = clientHeight - height;
    const top = (scrollTop / (scrollHeight - clientHeight)) * maxTop;
    setThumbHeight(height);
    setThumbTop(top);
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
      update();
      showTemporarily();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    return () => {
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
      const maxTop = clientHeight - thumbHeight;
      const delta = e.clientY - dragStartY.current;
      const scrollDelta = (delta / maxTop) * (scrollHeight - clientHeight);
      window.scrollTo(0, dragStartScroll.current + scrollDelta);
    },
    [dragging, thumbHeight]
  );

  const onPointerUp = useCallback(() => {
    setDragging(false);
    if (!hovering) {
      hideTimer.current = setTimeout(() => setVisible(false), 1200);
    }
  }, [hovering]);

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

  if (thumbHeight === 0) return null;

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
        className="absolute right-0.5 w-1.5 rounded-full transition-opacity duration-300"
        style={{
          height: thumbHeight,
          top: thumbTop,
          opacity: visible || dragging ? 1 : 0,
          background: "color-mix(in srgb, var(--muted-foreground) 40%, transparent)",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />
    </div>
  );
}

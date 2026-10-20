import { useEffect } from "react";

/**
 * Freezes the page behind a pop-up so scrolling moves the pop-up, not the screen underneath.
 * `overflow: hidden` alone is ignored by iPhone Safari, so the body is pinned in place
 * (`position: fixed`) and the scroll position is restored on close. Counted, so a pop-up opened
 * from another pop-up doesn't release the lock early.
 */
let locks = 0;
let saved: { y: number; style: Partial<CSSStyleDeclaration> } | null = null;

function lock() {
  if (locks++ > 0 || typeof document === "undefined") return;
  const b = document.body;
  const y = window.scrollY;
  saved = {
    y,
    style: {
      position: b.style.position,
      top: b.style.top,
      left: b.style.left,
      right: b.style.right,
      width: b.style.width,
      overflow: b.style.overflow,
    },
  };
  b.style.position = "fixed";
  b.style.top = `-${y}px`;
  b.style.left = "0";
  b.style.right = "0";
  b.style.width = "100%";
  b.style.overflow = "hidden";
}

function unlock() {
  if (--locks > 0 || !saved) return;
  locks = 0;
  const b = document.body;
  Object.assign(b.style, saved.style);
  window.scrollTo(0, saved.y);
  saved = null;
}

/** Call inside any full-screen overlay or bottom sheet while it is mounted/open. */
export function useScrollLock(active = true) {
  useEffect(() => {
    if (!active) return;
    lock();
    return unlock;
  }, [active]);
}

"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Ports the `.rv` → `.in` scroll-reveal pattern from design-reference.html:
 * elements start faded/translated, then an IntersectionObserver flips them
 * to their resting state the first time they cross into view (observer is
 * dropped after that, matching the reference's one-shot `io.unobserve`).
 *
 * Includes the same 8s safety-net timeout as the reference (in case the
 * observer never fires — e.g. an element that's already off-screen in a
 * layout the observer misjudges), and short-circuits to "revealed" when
 * the user prefers reduced motion or IntersectionObserver isn't available.
 */
export interface UseScrollRevealOptions {
  rootMargin?: string;
  threshold?: number;
  /** Safety-net timeout (ms) — force-reveal even if the observer never fires. */
  timeoutMs?: number;
}

export function useScrollReveal<T extends HTMLElement>(options: UseScrollRevealOptions = {}) {
  const { rootMargin = "0px 0px -8% 0px", threshold = 0.08, timeoutMs = 8000 } = options;
  const ref = useRef<T | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof window === "undefined") return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || typeof IntersectionObserver === "undefined") {
      queueMicrotask(() => setRevealed(true));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setRevealed(true);
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin, threshold },
    );
    io.observe(el);

    const timeout = window.setTimeout(() => setRevealed(true), timeoutMs);

    return () => {
      io.disconnect();
      window.clearTimeout(timeout);
    };
  }, [rootMargin, threshold, timeoutMs]);

  return { ref, revealed };
}

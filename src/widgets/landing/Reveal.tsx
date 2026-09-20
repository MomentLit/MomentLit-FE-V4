"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { useScrollReveal } from "@/shared/hooks/useScrollReveal";
import { cn } from "@/shared/lib";

/**
 * Client wrapper porting design-reference.html's `.rv`/`.in` scroll-reveal
 * pattern (see ANALYSIS.md §2.1) onto any landing section. Fades/slides its
 * children in the first time they scroll into view. Always renders a plain
 * `div` — for a section that needs a different semantic tag (e.g. the
 * category mosaic's `<nav>`), use `useScrollReveal` directly instead.
 */
export interface RevealProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Stagger delay in ms — mirrors the reference's per-card `transition-delay`. */
  delayMs?: number;
}

export function Reveal({ children, className, delayMs = 0, style, ...props }: RevealProps) {
  const { ref, revealed } = useScrollReveal<HTMLDivElement>();

  return (
    <div
      ref={ref}
      className={cn(
        "transition-[opacity,transform] duration-[750ms] ease-[cubic-bezier(0.2,0.9,0.25,1)] motion-reduce:transition-none",
        revealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-[18px]",
        className,
      )}
      style={{ transitionDelay: revealed ? `${delayMs}ms` : "0ms", ...style }}
      {...props}
    >
      {children}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { usePointerTrail } from "@/shared/hooks/usePointerTrail";
import { Logo } from "@/shared/ui";

/**
 * Full-screen opening overlay — ports the `.intro`/`#stage`/`#letters`
 * markup, CSS and dismiss logic from docs/design-reference.html (see
 * ANALYSIS.md §2.8).
 *
 * Differences from the static prototype (both intentional, per spec):
 *  - session-scoped "seen" flag via sessionStorage, so it only auto-plays
 *    once per browser tab session (the prototype had no such gate — its own
 *    file notes this as an unimplemented requirement).
 *  - `prefers-reduced-motion` skips the overlay outright instead of just
 *    disabling its animations.
 */

const SESSION_KEY = "ml-intro-seen";

type Fill = [col: number, row: number, color: string, delay: number];
type Letter = [col: number, row: number, char: string, white: 0 | 1, delay: number];

const FILLS: Fill[] = [
  [2, 2, "--violet", 0.3],
  [6, 1, "--lemon", 0.38],
  [1, 5, "--mint", 0.46],
  [7, 5, "--coral", 0.54],
  [3, 6, "--lime", 0.62],
  [5, 2, "--sky", 0.7],
  [4, 4, "--rose", 0.78],
  [8, 6, "--apricot", 0.86],
];

// "VALUABLE SPACE AND MOMENT" crossword layout — column/row offsets from the
// centred 8x6 block, ported verbatim from design-reference.html.
const LETTERS: Letter[] = [
  [5, 2, "S", 1, 0.74],
  [5, 3, "P", 0, 0.8],
  [5, 5, "C", 0, 0.92],
  [5, 6, "E", 0, 0.98],
  [8, 1, "M", 0, 1.04],
  [8, 2, "O", 0, 1.1],
  [8, 3, "M", 0, 1.16],
  [8, 5, "N", 0, 1.28],
  [8, 6, "T", 1, 1.34],
  [1, 4, "V", 0, 1.4],
  [2, 4, "A", 0, 1.46],
  [3, 4, "L", 0, 1.52],
  [4, 4, "U", 1, 1.58],
  [5, 4, "A", 0, 1.64],
  [6, 4, "B", 0, 1.7],
  [7, 4, "L", 0, 1.76],
  [8, 4, "E", 0, 1.82],
];

const SCATTER = ["--sky", "--mint", "--lime", "--lemon", "--apricot", "--coral", "--rose", "--violet"];

interface LettersLayoutState {
  c0?: number;
  r0?: number;
  cols?: number;
}

function layoutLetters(introEl: HTMLDivElement, lettersEl: HTMLDivElement, state: LettersLayoutState) {
  // Reading the raw `--cell` custom property text (e.g. "clamp(44px, 8.4vw,
  // 116px)") and parseFloat-ing it silently grabs the leading "44" instead
  // of the value the browser actually resolved it to — `getComputedStyle`
  // only resolves custom properties when read through a real property that
  // *uses* them, never the variable itself. `.ml-intro-letters` already has
  // `grid-auto-rows: var(--cell)` in its class, so read that instead (same
  // trick `usePointerTrail` uses via `gridAutoRows`). Getting this wrong
  // under-measured the cell by ~2-3x, so `cols`/`rows` came out far too
  // large and the whole centred crossword block was placed way outside the
  // visible viewport (letters "not visible" / needing to "move up").
  const cell = parseFloat(getComputedStyle(lettersEl).gridAutoRows) || 70;
  const cols = Math.max(8, Math.floor(introEl.clientWidth / cell));
  const rows = Math.max(6, Math.floor(introEl.clientHeight / cell));

  // Centre with a 1-track margin, but only when there's an actual spare
  // track to give it: `cols`/`rows` are already `Math.floor`'d from real
  // measurements, so the block (8 cols / 6 rows) is only guaranteed to fit
  // starting at offset 0 when there's no slack. Forcing offset 1
  // unconditionally (as design-reference.html's own JS does) pushes the
  // last row/column past the true last track on short/narrow viewports,
  // clipping the bottom-right letters against `overflow: hidden`.
  const c0 = cols > 8 ? Math.max(1, Math.round((cols - 8) / 2)) : 0;
  const r0 = rows > 6 ? Math.max(1, Math.round((rows - 6) / 2)) : 0;
  if (state.c0 === c0 && state.r0 === r0 && state.cols === cols && lettersEl.children.length) {
    return;
  }
  state.c0 = c0;
  state.r0 = r0;
  state.cols = cols;
  lettersEl.textContent = "";

  // Pin the grid to exactly `cols`x`rows` explicit tracks instead of relying
  // on the class's `repeat(auto-fill, var(--cell))`: auto-fill computes its
  // track count independently from the browser's fractional layout math,
  // which can disagree by one with this function's `Math.floor` — any cell
  // placed in that phantom extra column collapses to a sliver of leftover
  // color at the edge instead of not existing. Explicit tracks keep JS's
  // placement and the CSS grid in permanent agreement; any leftover space
  // becomes a plain (invisible) margin instead.
  lettersEl.style.gridTemplateColumns = `repeat(${cols}, var(--cell))`;
  lettersEl.style.gridTemplateRows = `repeat(${rows}, var(--cell))`;

  // Scatter colour cells across every row so they reach the top/bottom edges,
  // skipping the centred crossword block. Deterministic LCG, seeded the same
  // as the reference, so the scatter pattern matches on every load.
  let seed = 11;
  let k = 0;
  for (let rr = 1; rr <= rows; rr++) {
    const per = rr % 2 === 0 ? 3 : 2;
    for (let j = 0; j < per; j++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      let cc = 1 + ((seed >> 9) % cols);
      if (cc >= c0 && cc < c0 + 8 && rr >= r0 && rr < r0 + 6) {
        cc = ((cc + 4 + j * 3) % cols) + 1;
        if (cc >= c0 && cc < c0 + 8 && rr >= r0 && rr < r0 + 6) continue;
      }
      const el = document.createElement("i");
      el.className = "cl";
      el.style.gridColumn = String(cc);
      el.style.gridRow = String(rr);
      el.style.background = `var(${SCATTER[k % SCATTER.length]})`;
      el.style.animationDelay = `${(0.14 + k * 0.045).toFixed(2)}s`;
      lettersEl.appendChild(el);
      k++;
    }
  }

  FILLS.forEach(([dc, dr, color, delay]) => {
    const el = document.createElement("i");
    el.className = "cl";
    el.style.gridColumn = String(c0 + dc);
    el.style.gridRow = String(r0 + dr);
    el.style.background = `var(${color})`;
    el.style.animationDelay = `${delay + 0.95}s`;
    lettersEl.appendChild(el);
  });

  LETTERS.forEach(([dc, dr, char, white, delay]) => {
    const el = document.createElement("i");
    el.className = white ? "lt w" : "lt";
    el.style.gridColumn = String(c0 + dc);
    el.style.gridRow = String(r0 + dr);
    el.style.animationDelay = `${delay + 0.95}s`;
    if (char === "&") el.style.color = "var(--coral)";
    el.textContent = char;
    lettersEl.appendChild(el);
  });
}

type Phase = "pending" | "visible" | "dismissing" | "gone";

export function OpeningIntro() {
  const [phase, setPhase] = useState<Phase>("pending");
  const introRef = useRef<HTMLDivElement | null>(null);
  const lettersRef = useRef<HTMLDivElement | null>(null);
  const dismissedRef = useRef(false);
  const stageRef = usePointerTrail<HTMLDivElement>();

  const dismiss = useCallback(() => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    document.body.style.overflow = "";
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // sessionStorage unavailable (private mode / disabled storage) — fine,
      // the intro will just replay next time, which is an acceptable fallback.
    }
    setPhase("dismissing");
    const reduce =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(() => setPhase("gone"), reduce ? 0 : 950);
  }, []);

  // Decide, before first paint, whether the intro should play at all.
  useLayoutEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(SESSION_KEY) === "1";
    } catch {
      seen = false;
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (seen || reduce) {
      try {
        sessionStorage.setItem(SESSION_KEY, "1");
      } catch {
        // ignore
      }
      queueMicrotask(() => setPhase("gone"));
      return;
    }
    document.body.style.overflow = "hidden";
    queueMicrotask(() => setPhase("visible"));
  }, []);

  // Restore scroll if this ever unmounts mid-intro.
  useEffect(() => {
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // Build/relayout the crossword letters while visible.
  useEffect(() => {
    if (phase !== "visible") return;
    const introEl = introRef.current;
    const lettersEl = lettersRef.current;
    if (!introEl || !lettersEl) return;
    const state: LettersLayoutState = {};
    const run = () => layoutLetters(introEl, lettersEl, state);
    run();
    let resizeTimer: number;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(run, 180);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.clearTimeout(resizeTimer);
    };
  }, [phase]);

  // wheel / touch / keydown / click all dismiss, same as the reference.
  useEffect(() => {
    if (phase !== "visible") return;
    const onWheelOrTouch = () => dismiss();
    const onKeydown = (e: KeyboardEvent) => {
      if (e.key === "Tab" || e.key === "Shift") return;
      dismiss();
    };
    window.addEventListener("wheel", onWheelOrTouch, { passive: true });
    window.addEventListener("touchmove", onWheelOrTouch, { passive: true });
    window.addEventListener("keydown", onKeydown);
    return () => {
      window.removeEventListener("wheel", onWheelOrTouch);
      window.removeEventListener("touchmove", onWheelOrTouch);
      window.removeEventListener("keydown", onKeydown);
    };
  }, [phase, dismiss]);

  if (phase === "pending" || phase === "gone") return null;

  const introStyle = { "--cell": "clamp(44px, 8.4vw, 116px)" } as CSSProperties;

  return (
    <div
      ref={introRef}
      className={`ml-intro${phase === "dismissing" ? " ml-intro--off" : ""}`}
      style={introStyle}
      role="region"
      aria-label="오프닝"
      onClick={dismiss}
    >
      <div ref={stageRef} className="ml-intro-stage" aria-hidden="true" />
      <div ref={lettersRef} className="ml-intro-letters" role="img" aria-label="VALUABLE SPACE AND MOMENT" />
      <span className="ml-intro-logo">
        <span className="ml-intro-wordmark">
          <Logo size={48} />
        </span>
      </span>
      <div className="ml-intro-cue" aria-hidden="true">
        <span>↓</span>
      </div>

      {/*
        Plain (non-scoped) <style> tag rather than styled-jsx: styled-jsx
        needs a StyledJsxRegistry wired into the root layout to SSR cleanly
        under the App Router, which is out of scope here. A plain tag needs
        no compiler support and works identically since every selector below
        is already namespaced under `ml-intro-`.
      */}
      <style>{`
        .ml-intro {
          position: fixed;
          inset: 0;
          z-index: 400;
          background: #fff;
          overflow: hidden;
        }
        .ml-intro.ml-intro--off {
          opacity: 0;
          transform: scale(1.05);
          pointer-events: none;
          transition:
            opacity 0.9s cubic-bezier(0.4, 0, 0.2, 1),
            transform 0.9s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .ml-intro-stage,
        .ml-intro-letters {
          position: absolute;
          inset: 0;
          overflow: hidden;
          display: grid;
          grid-template-columns: repeat(auto-fill, var(--cell));
          grid-auto-rows: var(--cell);
        }
        .ml-intro-stage {
          z-index: 0;
          background-image:
            linear-gradient(to right, var(--line) 1px, transparent 1px),
            linear-gradient(to bottom, var(--line) 1px, transparent 1px);
          background-size: var(--cell) var(--cell);
        }
        .ml-intro-stage b {
          display: block;
          background: transparent;
          transition: background 0.8s cubic-bezier(0.3, 0, 0.5, 1);
        }
        .ml-intro-letters {
          z-index: 1;
          pointer-events: none;
        }
        .ml-intro-letters .cl {
          display: block;
          animation: mlCellIn 0.6s cubic-bezier(0.2, 0.9, 0.25, 1) both;
        }
        .ml-intro-letters .lt {
          display: grid;
          place-items: center;
          font-family: var(--font-en), sans-serif;
          font-weight: 900;
          font-size: calc(var(--cell) * 0.6);
          line-height: 1;
          color: var(--ink);
          animation: mlLetIn 0.5s cubic-bezier(0.2, 0.9, 0.25, 1) both;
        }
        @keyframes mlCellIn {
          from {
            opacity: 0;
            transform: scale(0.18);
          }
          to {
            opacity: 1;
            transform: none;
          }
        }
        @keyframes mlLetIn {
          from {
            opacity: 0;
            transform: translateY(-22px) scale(0.5);
          }
          to {
            opacity: 1;
            transform: none;
          }
        }
        .ml-intro-logo {
          position: absolute;
          top: clamp(18px, 2.6vw, 34px);
          left: clamp(18px, 2.6vw, 34px);
          z-index: 3;
          animation: mlFadeup 0.7s 0.1s cubic-bezier(0.2, 0.9, 0.25, 1) both;
        }
        .ml-intro-wordmark {
          display: inline-flex;
          align-items: center;
          gap: 10px;
        }
        .ml-intro-wm {
          font-family: var(--font-en), sans-serif;
          font-weight: 900;
          font-size: 1rem;
          letter-spacing: -0.025em;
          color: var(--ink);
        }
        .ml-intro-cue {
          position: absolute;
          left: 50%;
          bottom: clamp(18px, 2.6vw, 34px);
          z-index: 3;
          width: 44px;
          height: 44px;
          background: var(--ink);
          color: #fff;
          display: grid;
          place-items: center;
          font-size: 1.05rem;
          transform: translateX(-50%);
          animation: mlFadeup 0.7s 2.6s cubic-bezier(0.2, 0.9, 0.25, 1) both;
        }
        .ml-intro-cue span {
          display: block;
          animation: mlBob 2s 3.3s ease-in-out infinite;
        }
        @keyframes mlBob {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(4px);
          }
        }
        @keyframes mlFadeup {
          from {
            opacity: 0;
            transform: translateY(14px);
          }
          to {
            opacity: 1;
            transform: none;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .ml-intro-letters .cl,
          .ml-intro-letters .lt,
          .ml-intro-logo,
          .ml-intro-cue,
          .ml-intro-cue span {
            animation: none !important;
            opacity: 1 !important;
          }
          .ml-intro-cue {
            transform: translateX(-50%) !important;
          }
          .ml-intro-stage b {
            transition: none;
          }
          .ml-intro.ml-intro--off {
            transition: none;
          }
        }
      `}</style>
    </div>
  );
}

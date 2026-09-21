"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Ports the cursor-hover grid trail from docs/design-reference.html
 * (the `.gl`/`#stage` cell-painting logic in the inline <script> at the
 * bottom of the file). A grid of empty `<b>` cells is generated to match
 * the element's size against its `grid-auto-rows` cell size; on
 * `pointermove`, the cell under the cursor (plus its 4 neighbours) is
 * briefly tinted, then fades back out.
 *
 * Disabled entirely when the user prefers reduced motion — the element
 * still renders its static CSS grid-line background, it just never
 * paints a trail.
 */

const TRAIL_COLORS: Array<[number, number, number]> = [
  [95, 197, 252], // sky
  [74, 213, 213], // mint (aqua)
  [142, 182, 254], // lime (peri)
  [255, 213, 46], // lemon (butter)
  [242, 169, 60], // apricot
  [253, 159, 151], // coral (blush)
  [248, 142, 224], // rose (orchid)
  [193, 166, 252], // violet
];

const FALLBACK_CELL_PX = 76;
const MAX_CELLS = 900;
const FADE_MS = 150;

export function usePointerTrail<T extends HTMLElement>() {
  // A callback ref rather than a plain useRef: callers like OpeningIntro
  // render `null` on their very first pass (before deciding whether to
  // play at all), so the element doesn't exist yet when a plain ref's
  // effect (empty deps, mount-only) would run — it'd see `domRef.current
  // === null` forever and never build the grid. `mountTick` exists only to
  // re-trigger the effect once the node actually shows up (however many
  // renders that takes); the DOM node itself stays in a ref, not state, so
  // mutating its `.style` below isn't "modifying a useState value".
  const domRef = useRef<T | null>(null);
  const [mountTick, setMountTick] = useState(0);
  const ref = useCallback((el: T | null) => {
    domRef.current = el;
    setMountTick((t) => t + 1);
  }, []);

  useEffect(() => {
    const layer = domRef.current;
    if (!layer || typeof window === "undefined") return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    let cols = 0;
    let cellSize = FALLBACK_CELL_PX;

    function build() {
      if (!layer) return;
      const style = getComputedStyle(layer);
      cellSize = parseFloat(style.gridAutoRows) || FALLBACK_CELL_PX;
      const nextCols = Math.max(1, Math.ceil(layer.clientWidth / cellSize));
      const rows = Math.max(1, Math.ceil(layer.clientHeight / cellSize));
      const want = Math.min(nextCols * rows, MAX_CELLS);
      if (layer.childElementCount === want && cols === nextCols) return;
      cols = nextCols;
      // Pin explicit tracks (using the resolved px cell size, since callers
      // name their own `--cell`-like variable differently or hardcode it) so
      // this hook's `idx = row * cols + col` math always matches the grid
      // the browser actually renders — the class's own
      // `repeat(auto-fill, <cell>)` computes its track count independently
      // from fractional layout, which can disagree with this `Math.ceil`
      // and shift auto-placed cells into the wrong row/column.
      layer.style.gridTemplateColumns = `repeat(${nextCols}, ${cellSize}px)`;
      layer.style.gridTemplateRows = `repeat(${rows}, ${cellSize}px)`;
      const frag = document.createDocumentFragment();
      for (let i = 0; i < want; i++) frag.appendChild(document.createElement("b"));
      layer.textContent = "";
      layer.appendChild(frag);
    }

    function paint(idx: number, alpha: number, colorIdx: number) {
      if (idx < 0 || !layer) return;
      const cell = layer.children[idx] as (HTMLElement & { _fadeTimer?: number }) | undefined;
      if (!cell) return;
      const [r, g, b] = TRAIL_COLORS[((colorIdx % TRAIL_COLORS.length) + TRAIL_COLORS.length) % TRAIL_COLORS.length];
      cell.style.background = `rgba(${r},${g},${b},${alpha})`;
      window.clearTimeout(cell._fadeTimer);
      cell._fadeTimer = window.setTimeout(() => {
        cell.style.background = "";
      }, FADE_MS);
    }

    let pending: { x: number; y: number } | null = null;
    let ticking = false;

    function onPointerMove(e: PointerEvent) {
      if (!layer) return;
      const rect = layer.getBoundingClientRect();
      if (
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom
      ) {
        return;
      }
      pending = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const p = pending;
        if (!p || !cols) return;
        const col = Math.floor(p.x / cellSize);
        const row = Math.floor(p.y / cellSize);
        if (col < 0 || col >= cols) return;
        const idx = row * cols + col;
        const colorIdx = (col + row) % TRAIL_COLORS.length;
        paint(idx, 0.9, colorIdx);
        if (col > 0) paint(idx - 1, 0.24, colorIdx + 1);
        if (col < cols - 1) paint(idx + 1, 0.24, colorIdx + 1);
        paint(idx - cols, 0.24, colorIdx + 2);
        paint(idx + cols, 0.24, colorIdx + 2);
      });
    }

    build();
    const ro = new ResizeObserver(() => build());
    ro.observe(layer);
    window.addEventListener("pointermove", onPointerMove, { passive: true });

    return () => {
      ro.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
    };
  }, [mountTick]);

  return ref;
}

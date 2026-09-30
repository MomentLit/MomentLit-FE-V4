"use client";

import { usePointerTrail } from "@/shared/hooks/usePointerTrail";

/**
 * Grid-line background layer that lights up cells under the cursor — ports
 * `.gl`/`.gl.dark` from design-reference.html (used behind the hero and the
 * closing CTA). Sits absolutely behind its section's content; `pointer-events:
 * none` keeps it from ever intercepting clicks meant for that content.
 */
export function TrailLayer({ dark = false }: { dark?: boolean }) {
  const ref = usePointerTrail<HTMLDivElement>(true);

  return (
    <>
      <div ref={ref} className={`ml-gl${dark ? " ml-gl--dark" : ""}`} aria-hidden="true" />
      <style>{`
        .ml-gl{
          position:absolute;inset:0;z-index:0;overflow:hidden;pointer-events:none;
          display:grid;grid-auto-rows:clamp(44px,5vw,76px);
          --trail-cell-width:clamp(44px,5vw,76px);--trail-cell-height:clamp(44px,5vw,76px);
          background-image:linear-gradient(to right,var(--line) 1px,transparent 1px),linear-gradient(to bottom,var(--line) 1px,transparent 1px);
          background-size:var(--trail-cell-width) var(--trail-cell-height);
          box-shadow:inset -1px 0 var(--line),inset 0 -1px var(--line);
        }
        .ml-gl b{display:block;background:transparent;transition:background .8s cubic-bezier(.3,0,.5,1)}
        .ml-gl--dark{
          box-shadow:inset -1px 0 rgba(255,255,255,.07),inset 0 -1px rgba(255,255,255,.07);
          background-image:linear-gradient(to right,rgba(255,255,255,.07) 1px,transparent 1px),linear-gradient(to bottom,rgba(255,255,255,.07) 1px,transparent 1px);
        }
      `}</style>
    </>
  );
}

"use client";

import { usePointerTrail } from "@/shared/hooks/usePointerTrail";

/**
 * Grid-line background layer that lights up cells under the cursor — ports
 * `.gl`/`.gl.dark` from design-reference.html (used behind the hero and the
 * closing CTA). Sits absolutely behind its section's content; `pointer-events:
 * none` keeps it from ever intercepting clicks meant for that content.
 */
export function TrailLayer({ dark = false }: { dark?: boolean }) {
  const ref = usePointerTrail<HTMLDivElement>();

  return (
    <>
      <div ref={ref} className={`ml-gl${dark ? " ml-gl--dark" : ""}`} aria-hidden="true" />
      <style>{`
        .ml-gl{
          position:absolute;inset:0;z-index:0;overflow:hidden;pointer-events:none;
          display:grid;grid-template-columns:repeat(auto-fill,76px);grid-auto-rows:76px;
          background-image:linear-gradient(to right,var(--line) 1px,transparent 1px),linear-gradient(to bottom,var(--line) 1px,transparent 1px);
          background-size:76px 76px;
        }
        .ml-gl b{display:block;background:transparent;transition:background .8s cubic-bezier(.3,0,.5,1)}
        .ml-gl--dark{
          background-image:linear-gradient(to right,rgba(255,255,255,.07) 1px,transparent 1px),linear-gradient(to bottom,rgba(255,255,255,.07) 1px,transparent 1px);
        }
      `}</style>
    </>
  );
}

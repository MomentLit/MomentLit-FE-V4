"use client";

import Link from "next/link";
import { IconArrowRight } from "@tabler/icons-react";
import { SPACE_CATEGORY_COLORS, SPACE_CATEGORY_LABELS } from "@/entities/space-category";
import { useScrollReveal } from "@/shared/hooks/useScrollReveal";
import { cn } from "@/shared/lib";
import { Reveal } from "./Reveal";
import { CATEGORY_DISPLAY_ORDER, CATEGORY_MOSAIC_SPAN } from "./layoutConfig";

const TONE_BG: Record<string, string> = {
  sky: "bg-sky",
  lime: "bg-lime",
  lemon: "bg-lemon",
  coral: "bg-coral",
  rose: "bg-rose",
  violet: "bg-violet",
};

/** "어떤 공간이든" category mosaic — ports `.mos` from design-reference.html (ANALYSIS.md §2.1/§2.7). */
export function CategoryMosaic() {
  const { ref, revealed } = useScrollReveal<HTMLElement>();

  return (
    <section className="border-b border-line px-4 py-11 sm:px-6 sm:py-16 lg:py-20">
      <Reveal className="mb-5 flex flex-wrap items-end justify-between gap-x-10 gap-y-3 sm:mb-8">
        <h2
          className="text-[clamp(1.5rem,3.2vw,2.4rem)] leading-[1.2] tracking-tight text-ink"
          style={{ fontFamily: "var(--font-display)" }}
        >
          어떤 공간이든
        </h2>
        <p className="max-w-[30ch] text-[0.89rem] leading-[1.75] text-soft">
          연습실 한 칸부터 팝업스토어용 매장까지, 열 가지 유형으로 등록됩니다.
        </p>
      </Reveal>

      <nav
        ref={ref}
        aria-label="공간 카테고리"
        className={cn(
          "grid grid-cols-2 auto-rows-[minmax(104px,auto)] gap-0.5 bg-ink shadow-[0_0_0_1px_var(--ink)] sm:grid-cols-4 lg:grid-cols-6",
          "transition-[opacity,transform] duration-[750ms] ease-[cubic-bezier(0.2,0.9,0.25,1)] motion-reduce:transition-none",
          revealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-[18px]",
        )}
      >
        {CATEGORY_DISPLAY_ORDER.map((category, i) => {
          const span = CATEGORY_MOSAIC_SPAN[category];
          const spanClass = cn(span.w === 2 && "lg:col-span-2", span.h === 2 && "lg:row-span-2");
          const num = String(i + 1).padStart(2, "0");

          if (category === "OTHER") {
            return (
              <Link
                key={category}
                href="/search"
                className={cn(
                  "group relative flex flex-col justify-between overflow-hidden bg-white p-3.5 text-ink transition-colors duration-200 hover:bg-wash",
                  spanClass,
                )}
              >
                <span className="text-[0.63rem] tracking-[0.12em] opacity-55" style={{ fontFamily: "var(--font-label)" }}>
                  {num}
                </span>
                <span
                  className="text-[clamp(1rem,1.5vw,1.34rem)] leading-[1.16] tracking-tight"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {SPACE_CATEGORY_LABELS[category]}
                </span>
                <IconArrowRight
                  aria-hidden
                  size={16}
                  stroke={2}
                  className="absolute bottom-3.5 right-3.5 -translate-x-1.5 opacity-0 transition-[opacity,transform] duration-200 group-hover:translate-x-0 group-hover:opacity-90"
                />
              </Link>
            );
          }

          return (
            <Link
              key={category}
              href="/search"
              className={cn(
                "group relative flex flex-col justify-between overflow-hidden p-3.5 text-ink transition-[filter] duration-200 hover:[filter:brightness(1.06)_saturate(1.12)]",
                TONE_BG[SPACE_CATEGORY_COLORS[category]],
                spanClass,
              )}
            >
              <span className="text-[0.63rem] tracking-[0.12em] opacity-55" style={{ fontFamily: "var(--font-label)" }}>
                {num}
              </span>
              <span
                className="text-[clamp(1rem,1.5vw,1.34rem)] leading-[1.16] tracking-tight"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {SPACE_CATEGORY_LABELS[category]}
              </span>
              <IconArrowRight
                aria-hidden
                size={16}
                stroke={2}
                className="absolute bottom-3.5 right-3.5 -translate-x-1.5 opacity-0 transition-[opacity,transform] duration-200 group-hover:translate-x-0 group-hover:opacity-90"
              />
            </Link>
          );
        })}
      </nav>
    </section>
  );
}

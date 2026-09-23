import Link from "next/link";
import { REGIONS, REGION_COLORS, REGION_LABELS } from "@/entities/region";
import { Reveal } from "./Reveal";

const TONE_BG: Record<string, string> = {
  sky: "bg-sky",
  lime: "bg-lime",
  lemon: "bg-lemon",
  coral: "bg-coral",
  rose: "bg-rose",
  violet: "bg-violet",
};

const TONE_HOVER_BG: Record<string, string> = {
  sky: "hover:bg-sky",
  lime: "hover:bg-lime",
  lemon: "hover:bg-lemon",
  coral: "hover:bg-coral",
  rose: "hover:bg-rose",
  violet: "hover:bg-violet",
};

/** "지역별로 보기" — ports `.regs`/`.reg` from design-reference.html (ANALYSIS.md §2.1). */
export function RegionGrid() {
  return (
    <section className="border-b border-line px-4 py-11 sm:px-6 sm:py-16 lg:py-20">
      <Reveal className="mb-5 flex flex-wrap items-end justify-between gap-x-10 gap-y-3 sm:mb-8">
        <h2
          className="text-[clamp(1.5rem,3.2vw,2.4rem)] leading-[1.2] tracking-tight text-ink"
          style={{ fontFamily: "var(--font-display)" }}
        >
          지역별로 보기
        </h2>
        <p className="max-w-[30ch] text-[0.89rem] leading-[1.75] text-soft">
          서울에만 몰려 있지 않습니다. 지역을 골라 바로 훑어볼 수 있습니다.
        </p>
      </Reveal>

      <Reveal className="grid grid-cols-2 gap-px bg-line shadow-[0_0_0_1px_var(--line)] lg:grid-cols-4">
        {REGIONS.map((region, i) => {
          const tone = REGION_COLORS[region];
          return (
            <Link
              key={region}
              href={`/search?region=${region}`}
              className={`group flex flex-col gap-6 bg-white p-4 pb-[18px] text-ink transition-colors ${TONE_HOVER_BG[tone]}`}
            >
              <span className="flex items-center gap-2">
                <i className={`block h-[9px] w-[9px] transition-colors group-hover:bg-ink ${TONE_BG[tone]}`} />
                <span className="text-[0.63rem] tracking-[0.1em]" style={{ fontFamily: "var(--font-label)" }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
              </span>
              <span
                className="mt-auto text-[1.12rem] leading-none tracking-tight"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {REGION_LABELS[region]}
              </span>
            </Link>
          );
        })}
      </Reveal>
    </section>
  );
}

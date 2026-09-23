import Link from "next/link";
import { IconArrowRight } from "@tabler/icons-react";
import { TrailLayer } from "./TrailLayer";
import { Reveal } from "./Reveal";

/** Closing CTA — ports `.close` from design-reference.html (ANALYSIS.md §2.1). */
export function ClosingCta() {
  return (
    <section className="relative overflow-hidden bg-ink px-4 py-[50px] text-white sm:px-6 sm:py-20 lg:py-24">
      <TrailLayer dark />

      <div className="relative z-[2]">
        <Reveal>
          <h2
            className="max-w-[17ch] text-[clamp(1.9rem,4.6vw,3.6rem)] leading-[1.14] tracking-tight text-balance"
            style={{ fontFamily: "var(--font-display)" }}
          >
            등록에 드는 건
            <br />
            <span className="text-lemon">5분</span>입니다
          </h2>
        </Reveal>

        <Reveal
          delayMs={80}
          className="mt-6 grid grid-cols-1 items-end gap-6 sm:mt-9 lg:grid-cols-[1.15fr_1fr] lg:gap-10"
        >
          <p className="max-w-[36ch] text-[0.95rem] leading-[1.85] text-gray-400">
            사진이 없어도 등록됩니다. 비어 있는 시간대만 골라 열어두고, 요청을 받을지는 직접 정하세요. 등록에도 승인에도
            수수료는 없습니다.
          </p>
          <div className="flex flex-wrap justify-start gap-2.5 lg:justify-end">
            <Link
              href="/spaces/new"
              className="group inline-flex items-center gap-2.5 bg-sky px-6 py-4 text-[0.94rem] font-bold text-ink transition-colors hover:bg-white"
            >
              공간 등록하기
              <IconArrowRight size={18} stroke={2} className="transition-transform duration-200 group-hover:translate-x-1" aria-hidden />
            </Link>
            <Link
              href="/spaces/new"
              className="inline-flex items-center px-6 py-4 text-[0.94rem] font-bold text-white shadow-[inset_0_0_0_1.5px_rgba(255,255,255,0.35)] transition-colors hover:bg-white hover:text-ink"
            >
              호스트 안내
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

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
          {/* 어절 중간에서 끊기지 않도록 의미 단위로 줄을 나눈다. */}
          <p className="text-[0.95rem] leading-[1.85] break-keep text-gray-400">
            <span className="block">사진이 없어도 등록됩니다.</span>
            <span className="block">
              비어 있는 시간대만 골라 열어두고,
              <br className="sm:hidden" /> 요청을 받을지는 직접 정하세요.
            </span>
            <span className="block">등록에도 승인에도 수수료는 없습니다.</span>
          </p>
          <div className="flex flex-wrap justify-start gap-2.5 lg:justify-end">
            <Link
              href="/spaces/new"
              className="button button--primary group"
            >
              공간 등록하기
              <IconArrowRight size={18} stroke={2} className="transition-transform duration-200 group-hover:translate-x-1" aria-hidden />
            </Link>
            <Link
              href="/#host-guide"
              className="button button--inverse"
            >
              호스트 안내
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

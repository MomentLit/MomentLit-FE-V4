import Link from "next/link";
import { IconArrowRight } from "@tabler/icons-react";
import { Reveal } from "./Reveal";

const GUEST_STEPS = [
  "지역·카테고리·날짜로 조건에 맞는 공간만 추립니다",
  "호스트가 열어둔 시간대 중 원하는 구간에 예약을 보냅니다",
  "승인 전까지 메시지로 조건을 직접 조율합니다",
];

const HOST_STEPS = [
  "비어 있는 시간대만 골라 일정을 열어둡니다",
  "들어온 요청을 보고 직접 승인하거나 거절합니다",
  "내 공간에서 열린 팝업 기록이 그대로 남습니다",
];

/** "양쪽 모두의 자리" — ports `.duo` from design-reference.html (ANALYSIS.md §2.1). */
export function DuoSection() {
  return (
    <section className="border-b border-line px-4 py-11 sm:px-6 sm:py-16 lg:py-20">
      <Reveal className="mb-5 flex flex-wrap items-end justify-between gap-x-10 gap-y-3 sm:mb-8">
        <h2
          className="text-[clamp(1.5rem,3.2vw,2.4rem)] leading-[1.2] tracking-tight text-ink"
          style={{ fontFamily: "var(--font-display)" }}
        >
          양쪽 모두의 자리
        </h2>
        <p className="max-w-[30ch] text-[0.89rem] leading-[1.75] text-soft">
          빌리는 쪽과 빌려주는 쪽을 같은 무게로 다룹니다.
        </p>
      </Reveal>

      <Reveal className="grid grid-cols-1 gap-px bg-ink shadow-[0_0_0_1px_var(--ink)] md:grid-cols-2">
        <div className="flex flex-col gap-[18px] bg-sky p-6 text-ink sm:p-9">
          <span
            className="text-[0.66rem] font-medium uppercase tracking-[0.18em] text-ink/55"
            style={{ fontFamily: "var(--font-label)" }}
          >
            Guest
          </span>
          <h3
            className="text-[clamp(1.3rem,2.5vw,1.9rem)] leading-[1.26] tracking-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            공간이 필요한
            <br />
            브랜드
          </h3>
          <ol className="flex flex-col">
            {GUEST_STEPS.map((step, i) => (
              <li
                key={step}
                className={`grid grid-cols-[26px_1fr] gap-2.5 py-3 text-[0.91rem] leading-[1.7] ${i !== 0 ? "shadow-[inset_0_1px_0_rgba(21,23,28,0.18)]" : ""}`}
              >
                <i className="pt-[0.4em] text-[0.65rem] not-italic opacity-70" style={{ fontFamily: "var(--font-label)" }}>
                  {String(i + 1).padStart(2, "0")}
                </i>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <Link
            href="/search"
            className="group mt-auto inline-flex w-fit items-center gap-2.5 bg-white px-6 py-4 text-[0.94rem] font-bold text-ink transition-colors hover:bg-lemon"
          >
            공간 둘러보기
            <IconArrowRight size={18} stroke={2} className="transition-transform duration-200 group-hover:translate-x-1" aria-hidden />
          </Link>
        </div>

        <div className="flex flex-col gap-[18px] bg-lemon p-6 text-ink sm:p-9">
          <span
            className="text-[0.66rem] font-medium uppercase tracking-[0.18em] text-ink/55"
            style={{ fontFamily: "var(--font-label)" }}
          >
            Host
          </span>
          <h3
            className="text-[clamp(1.3rem,2.5vw,1.9rem)] leading-[1.26] tracking-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            공간을 내주는
            <br />
            사람
          </h3>
          <ol className="flex flex-col">
            {HOST_STEPS.map((step, i) => (
              <li
                key={step}
                className={`grid grid-cols-[26px_1fr] gap-2.5 py-3 text-[0.91rem] leading-[1.7] ${i !== 0 ? "shadow-[inset_0_1px_0_rgba(21,23,28,0.18)]" : ""}`}
              >
                <i className="pt-[0.4em] text-[0.65rem] not-italic opacity-70" style={{ fontFamily: "var(--font-label)" }}>
                  {String(i + 1).padStart(2, "0")}
                </i>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <Link
            href="/spaces/new"
            className="group mt-auto inline-flex w-fit items-center gap-2.5 bg-sky px-6 py-4 text-[0.94rem] font-bold text-ink transition-colors hover:bg-main-d hover:text-white"
          >
            공간 등록하기
            <IconArrowRight size={18} stroke={2} className="transition-transform duration-200 group-hover:translate-x-1" aria-hidden />
          </Link>
        </div>
      </Reveal>
    </section>
  );
}

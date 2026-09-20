import { Reveal } from "./Reveal";

const STEPS: Array<{ tone: string; label: string; title: string; body: string }> = [
  {
    tone: "bg-sky",
    label: "STEP 01",
    title: "찾기",
    body: "지역과 카테고리로 범위를 좁히고 공간과 팝업을 한 번에 훑습니다.",
  },
  {
    tone: "bg-lemon",
    label: "STEP 02",
    title: "요청",
    body: "호스트가 열어둔 시간대 중 원하는 구간을 골라 예약을 보냅니다.",
  },
  {
    tone: "bg-mint",
    label: "STEP 03",
    title: "확정",
    body: "호스트가 승인하면 확정됩니다. 남은 이야기는 메시지에서 이어갑니다.",
  },
];

/** "예약이 잡히기까지" — ports `.steps` from design-reference.html (ANALYSIS.md §2.1). */
export function StepsSection() {
  return (
    <section className="border-b border-line px-4 py-11 sm:px-6 sm:py-16 lg:py-20">
      <Reveal className="mb-5 flex flex-wrap items-end justify-between gap-x-10 gap-y-3 sm:mb-8">
        <h2
          className="text-[clamp(1.5rem,3.2vw,2.4rem)] leading-[1.2] tracking-tight text-ink"
          style={{ fontFamily: "var(--font-display)" }}
        >
          예약이 잡히기까지
        </h2>
        <p className="max-w-[30ch] text-[0.89rem] leading-[1.75] text-soft">
          요청을 보낸 뒤 호스트가 승인하면 확정됩니다.
        </p>
      </Reveal>

      <Reveal className="grid grid-cols-1 gap-px bg-line shadow-[0_0_0_1px_var(--line)] md:grid-cols-3">
        {STEPS.map((step) => (
          <div key={step.label} className="flex flex-col gap-2.5 bg-white px-5 pb-[26px] pt-[22px]">
            <span className="mb-1.5 flex items-center gap-2.5">
              <i className={`block h-2.5 w-2.5 ${step.tone}`} />
              <span className="text-[0.66rem] tracking-[0.14em] text-soft" style={{ fontFamily: "var(--font-label)" }}>
                {step.label}
              </span>
            </span>
            <h3 className="text-[1.2rem] tracking-tight text-ink" style={{ fontFamily: "var(--font-display)" }}>
              {step.title}
            </h3>
            <p className="text-[0.88rem] leading-[1.75] text-soft">{step.body}</p>
          </div>
        ))}
      </Reveal>
    </section>
  );
}

import { AiIcon } from "./AiIcon";

export interface AiSummaryCardProps {
  label: string;
  status: "PENDING" | "COMPLETED";
  text?: string | null;
}

/**
 * 공간/팝업 상세의 "AI 소개" 섹션. 일반 설명 문단과 구분되도록 느리게 움직이는 그라데이션 테두리,
 * AI 아이콘, "AI" 태그로 AI가 쓴 내용임을 드러낸다. 사이트의 각진 모양에 맞춰 둥근 모서리·퍼지는 효과는 쓰지 않는다.
 */
export function AiSummaryCard({ label, status, text }: AiSummaryCardProps) {
  return (
    <section
      aria-live={status === "PENDING" ? "polite" : undefined}
      className="ai-summary-card bg-gradient-to-br from-violet via-sky to-rose p-[2px]"
    >
      <div className="relative bg-white p-5">
        <div className="mb-3 flex items-center gap-2.5">
          <AiIcon size={26} tone="brand" />
          <span className="bg-gradient-to-r from-violet via-main-d to-sky bg-clip-text text-base font-extrabold tracking-tight text-transparent">
            {label}
          </span>
          <span className="ml-auto flex items-center gap-1 bg-ink px-2 py-1 font-mono text-[0.6rem] font-bold uppercase tracking-[0.14em] text-white">
            <AiIcon size={11} />
            AI
          </span>
        </div>

        {status === "PENDING" ? (
          <div>
            <p className="text-[0.92rem] text-soft">AI가 이 소개를 작성하고 있어요…</p>
            <div aria-hidden className="mt-3 h-3 w-[92%] animate-pulse bg-gradient-to-r from-violet/35 via-sky/35 to-rose/35" />
            <div aria-hidden className="mt-2 h-3 w-[68%] animate-pulse bg-gradient-to-r from-violet/35 via-sky/35 to-rose/35" />
          </div>
        ) : (
          <p className="text-[0.92rem] leading-[1.9] text-ink">{text}</p>
        )}
      </div>
    </section>
  );
}

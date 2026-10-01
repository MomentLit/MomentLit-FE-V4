import { Sparkles } from "lucide-react";

export interface AiSummaryCardProps {
  label: string;
  status: "PENDING" | "COMPLETED";
  text?: string | null;
}

/**
 * 공간/팝업 상세의 "AI 소개" 섹션. 일반 설명 문단과 확실히 구분되도록, 느리게
 * 움직이는 그라데이션 테두리 + 발광 아이콘 배지 + "AI" 태그로 확실하게 AI가
 * 생성한 내용임을 드러낸다.
 */
export function AiSummaryCard({ label, status, text }: AiSummaryCardProps) {
  return (
    <section
      aria-live={status === "PENDING" ? "polite" : undefined}
      className="ai-summary-card rounded-[1.75rem] bg-gradient-to-br from-violet via-sky to-rose p-[2px] shadow-[0_10px_30px_-12px_var(--color-violet)]"
    >
      <div className="relative overflow-hidden rounded-[1.65rem] bg-white p-5">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-violet/25 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-12 -left-8 h-28 w-28 rounded-full bg-sky/25 blur-3xl"
        />

        <div className="relative mb-3 flex items-center gap-2.5">
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet to-sky text-white shadow-[0_0_18px_-2px_var(--color-violet)]">
            <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-violet/60" />
            <Sparkles size={16} aria-hidden className="relative" />
          </span>
          <span className="bg-gradient-to-r from-violet via-main-d to-sky bg-clip-text text-base font-extrabold tracking-tight text-transparent">
            {label}
          </span>
          <span className="ml-auto flex items-center gap-1 rounded-full bg-ink px-2.5 py-1 font-mono text-[0.6rem] font-bold uppercase tracking-[0.14em] text-white">
            <Sparkles size={10} aria-hidden />
            AI
          </span>
        </div>

        {status === "PENDING" ? (
          <div className="relative">
            <p className="text-[0.92rem] text-soft">AI가 이 소개를 작성하고 있어요…</p>
            <div
              aria-hidden
              className="mt-3 h-3 w-[92%] animate-pulse rounded-full bg-gradient-to-r from-violet/35 via-sky/35 to-rose/35"
            />
            <div
              aria-hidden
              className="mt-2 h-3 w-[68%] animate-pulse rounded-full bg-gradient-to-r from-violet/35 via-sky/35 to-rose/35"
            />
          </div>
        ) : (
          <p className="relative text-[0.92rem] leading-[1.9] text-ink">{text}</p>
        )}
      </div>
    </section>
  );
}

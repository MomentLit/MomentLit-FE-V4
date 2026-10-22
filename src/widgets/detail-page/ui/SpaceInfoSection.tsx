import { AiSummaryCard } from "@/shared/ui";
import { splitSpaceDescription, type SpaceDetail } from "@/entities/space";
import { USAGE_UNIT_LABELS } from "../model/queries";

const FALLBACK = "정보 없음";

/** AI 요약 + 소개 + 기타사항 + 기본 정보(면적/수용인원/이용단위/층수/주차). Ported from design-reference `.dsec`/`.facts`. */
export function SpaceInfoSection({ space }: { space: SpaceDetail }) {
  const { description, notice } = splitSpaceDescription(space.description);
  const facts: Array<{ label: string; value: string }> = [
    {
      label: "면적",
      value: space.area != null ? `${space.area}㎡ / 약 ${Math.round(space.area / 3.3)}평` : FALLBACK,
    },
    {
      label: "수용 인원",
      value: space.capacity != null ? `최대 ${space.capacity}인` : FALLBACK,
    },
    {
      label: "이용 단위",
      value: space.usage_unit ? USAGE_UNIT_LABELS[space.usage_unit] : FALLBACK,
    },
    // 등록 폼 placeholder가 "예: 2층"이라 호스트가 이미 "층"을 붙여 입력하는 경우가 많다 —
    // 무조건 붙이면 "2층층"이 되므로 저장된 값의 끝에 이미 있으면 한 번만 남긴다.
    { label: "층수", value: space.floor ? `${space.floor.replace(/층\s*$/, "")}층` : FALLBACK },
    { label: "주차", value: space.parking_info ?? FALLBACK },
  ];

  return (
    <div className="flex flex-col gap-9">
      {/* 짧은 요약을 먼저 읽고 호스트가 쓴 소개·기타사항·기본 정보로 내려가게 맨 위에 둔다. */}
      {space.ai_summary_status === "PENDING" && <AiSummaryCard label="AI 소개" status="PENDING" />}

      {space.ai_summary_status === "COMPLETED" && space.ai_summary && (
        <AiSummaryCard label="AI 소개" status="COMPLETED" text={space.ai_summary} />
      )}

      <section>
        <h3 className="mb-3 text-lg font-semibold tracking-tight text-ink">공간 소개</h3>
        {/* 호스트가 입력한 줄바꿈·빈 줄을 그대로 살린다. 긴 URL 등은 줄 안에서 끊는다. */}
        <p className="whitespace-pre-line break-words text-[0.92rem] leading-[1.9] text-soft">{description}</p>
      </section>

      {notice && (
        <section>
          <h3 className="mb-3 text-lg font-semibold tracking-tight text-ink">기타사항</h3>
          <p className="whitespace-pre-line break-words bg-wash px-4.5 py-4 text-[0.92rem] leading-[1.9] text-soft shadow-[inset_3px_0_0_var(--sky)]">
            {notice}
          </p>
        </section>
      )}

      <section>
        <h3 className="mb-3 text-lg font-semibold tracking-tight text-ink">기본 정보</h3>
        {/* 한 줄에 2칸(PC 3칸)씩 놓고, 마지막 줄에 남는 자리는 그 줄 항목이 나눠 채워 빈칸이 생기지 않게 한다. */}
        <div className="flex flex-wrap gap-px overflow-hidden rounded-xl bg-line ring-1 ring-line">
          {facts.map((fact) => (
            <div key={fact.label} className="flex flex-1 basis-[calc(50%-1px)] flex-col gap-1 bg-white p-3.5 sm:basis-[calc(33.333%-1px)]">
              <span className="font-mono text-[0.6rem] uppercase tracking-wide text-soft">
                {fact.label}
              </span>
              <b className="text-[0.94rem] font-bold text-ink">{fact.value}</b>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

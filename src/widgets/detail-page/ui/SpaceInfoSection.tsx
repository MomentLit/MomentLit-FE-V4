import type { SpaceDetail } from "@/entities/space";
import { USAGE_UNIT_LABELS } from "../model/queries";

const FALLBACK = "정보 없음";

/** 소개 + 기본 정보(면적/수용인원/이용단위/층수/주차) + AI 요약. Ported from design-reference `.dsec`/`.facts`. */
export function SpaceInfoSection({ space }: { space: SpaceDetail }) {
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
      <section>
        <h3 className="mb-3 text-lg font-semibold tracking-tight text-ink">공간 소개</h3>
        <p className="text-[0.92rem] leading-[1.9] text-soft">{space.description}</p>
      </section>

      <section>
        <h3 className="mb-3 text-lg font-semibold tracking-tight text-ink">기본 정보</h3>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-line ring-1 ring-line sm:grid-cols-3">
          {facts.map((fact) => (
            <div key={fact.label} className="flex flex-col gap-1 bg-white p-3.5">
              <span className="font-mono text-[0.6rem] uppercase tracking-wide text-soft">
                {fact.label}
              </span>
              <b className="text-[0.94rem] font-bold text-ink">{fact.value}</b>
            </div>
          ))}
        </div>
      </section>

      {space.ai_summary && (
        <section>
          <h3 className="mb-3 text-lg font-semibold tracking-tight text-ink">AI 요약</h3>
          <p className="text-[0.92rem] leading-[1.9] text-soft">{space.ai_summary}</p>
        </section>
      )}
    </div>
  );
}

"use client";

import type { CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { IconX } from "@tabler/icons-react";
import { splitSpaceDescription } from "@/entities/space";
import { fetchSpace } from "@/entities/space/api";
import { SPACE_CATEGORY_COLORS, SPACE_CATEGORY_LABELS } from "@/entities/space-category";
import { Modal } from "@/shared/ui/Modal";
import { MediaPhoto } from "@/shared/ui/MediaPhoto";
import { placeText, priceText, SpacePhoto, toneVar, type SpotlightSpace } from "./SpotlightCard";
import { TodayRibbon } from "./TodayRibbon";
import type { TodayStatus } from "./today";

// 패널(Modal)에는 style을 넘길 수 없어서, 카테고리 색 그림자를 색마다 정적 클래스로 둔다.
const PANEL_SHADOW: Record<string, string> = {
  sky: "shadow-[inset_0_0_0_1.5px_var(--ink),10px_10px_0_var(--sky)]",
  lime: "shadow-[inset_0_0_0_1.5px_var(--ink),10px_10px_0_var(--lime)]",
  lemon: "shadow-[inset_0_0_0_1.5px_var(--ink),10px_10px_0_var(--lemon)]",
  coral: "shadow-[inset_0_0_0_1.5px_var(--ink),10px_10px_0_var(--coral)]",
  rose: "shadow-[inset_0_0_0_1.5px_var(--ink),10px_10px_0_var(--rose)]",
  violet: "shadow-[inset_0_0_0_1.5px_var(--ink),10px_10px_0_var(--violet)]",
};

/**
 * 카드의 눈 버튼으로 여는 미리보기 — 상세에 들어가기 전에 사진·소개·기본 정보·오늘 빈 시간을 본다.
 * 상세로 가는 버튼은 두지 않는다(카드 자체가 상세 링크).
 */
export function SpacePreviewModal({
  space,
  today,
  onClose,
}: {
  space: SpotlightSpace;
  today: TodayStatus | undefined;
  onClose: () => void;
}) {
  // 상세 페이지와 같은 캐시 키 — 미리보기 후 상세로 들어가면 바로 뜬다.
  const detail = useQuery({ queryKey: ["space", space.space_id], queryFn: () => fetchSpace(space.space_id), retry: 1 });
  const price = priceText(space);
  const photo = detail.data?.image_urls[0] ?? space.thumbnail_url;
  const intro = detail.data
    ? detail.data.ai_summary || splitSpaceDescription(detail.data.description).description
    : null;

  const facts = [
    { label: "요금", value: [price.amount, price.unit].filter(Boolean).join(" ") },
    { label: "수용 인원", value: space.capacity != null ? `최대 ${space.capacity}인` : "정보 없음" },
    { label: "면적", value: space.area != null ? `${space.area}㎡` : "정보 없음" },
  ];

  return (
    <Modal
      label={`${space.name} 미리보기`}
      onClose={onClose}
      panelClassName={`relative grid w-full max-w-[880px] overflow-y-auto bg-white sm:grid-cols-2 ${PANEL_SHADOW[SPACE_CATEGORY_COLORS[space.category]]}`}
    >
      <div style={{ "--ac": toneVar(space) } as CSSProperties} className="contents">
        <div className="relative min-h-[240px] overflow-hidden sm:min-h-[380px]">
          {photo ? (
            <MediaPhoto src={photo} alt={space.name} className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <SpacePhoto space={space} className="absolute inset-0" />
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-5 p-6 sm:p-8">
          <div className="flex flex-col gap-2 pr-10">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-soft">
              <i className="block h-2 w-2" style={{ background: "var(--ac)" }} />
              {SPACE_CATEGORY_LABELS[space.category]}
              {space.option_group && ` · 구역 ${space.option_group.count}곳`}
            </span>
            <h3 className="text-[clamp(1.5rem,2.6vw,2rem)] leading-tight tracking-tight text-ink" style={{ fontFamily: "var(--font-display)" }}>
              {space.name}
            </h3>
            <span className="text-sm text-soft">{placeText(space)}</span>
          </div>

          <p className="line-clamp-5 whitespace-pre-line break-words text-[0.9rem] leading-[1.8] text-soft">
            {intro === null ? "소개를 불러오는 중…" : intro || "아직 소개가 없어요."}
          </p>

          <dl className="grid grid-cols-3 gap-px bg-line shadow-[0_0_0_1px_var(--line)]">
            {facts.map((fact) => (
              <div key={fact.label} className="flex min-w-0 flex-col gap-1 bg-white p-3">
                <dt className="text-[0.62rem] tracking-wide text-soft" style={{ fontFamily: "var(--font-label)" }}>
                  {fact.label}
                </dt>
                <dd className="break-keep text-sm font-bold text-ink">{fact.value}</dd>
              </div>
            ))}
          </dl>

          <TodayRibbon status={today} />
        </div>
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label="미리보기 닫기"
        className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center bg-white text-ink shadow-[inset_0_0_0_1px_var(--line)] transition-colors hover:bg-lemon"
      >
        <IconX size={18} stroke={2} aria-hidden />
      </button>
    </Modal>
  );
}

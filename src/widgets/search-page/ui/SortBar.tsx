"use client";

import { cn } from "@/shared/lib";
import { REGION_LABELS, type Region } from "@/entities/region";
import { SPACE_CATEGORY_LABELS, type SpaceCategory } from "@/entities/space-category";
import type { SortKey } from "../lib/constants";

interface SortBarProps {
  categories: SpaceCategory[];
  regions: Region[];
  totalElements: number;
  sort: SortKey;
  onSortChange: (sort: SortKey) => void;
  geoStatus: "idle" | "loading" | "denied";
  /** "공간"(기본) 또는 "팝업" — 헤딩/개수 단위 문구만 바뀐다. */
  itemLabel?: string;
  unitLabel?: string;
  /** 팝업엔 좌표가 없어 "가까운순"이 안 맞는다 — 그 모드에선 숨긴다. */
  showDistance?: boolean;
}

const SORT_ITEMS: { key: SortKey; label: string }[] = [
  { key: "latest", label: "최신순" },
  { key: "popular", label: "인기순" },
];

/** Results header + sort toggle. "가까운순"은 브라우저 위치 권한을 받아 거리순으로 다시 검색한다. */
export function SortBar({
  categories,
  regions,
  totalElements,
  sort,
  onSortChange,
  geoStatus,
  itemLabel = "공간",
  unitLabel = "곳",
  showDistance = true,
}: SortBarProps) {
  const labelParts = [
    regions.map((region) => REGION_LABELS[region]).join(", "),
    categories.map((category) => SPACE_CATEGORY_LABELS[category]).join(", "),
  ].filter(Boolean);
  const heading = labelParts.length > 0 ? labelParts.join(", ") : `전체 ${itemLabel}`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line app-gutter py-4">
      <h2 className="section-title text-ink">
        {heading} <em className="font-bold not-italic text-main-d">{totalElements}</em>
        {unitLabel}
      </h2>
      <div className="flex gap-0 border border-line divide-x divide-line">
        {SORT_ITEMS.map((item) => (
          <button
            key={item.key}
            type="button"
            aria-pressed={sort === item.key}
            onClick={() => onSortChange(item.key)}
            className={cn(
              "min-h-11 px-3 py-2 text-sm font-bold transition-colors",
              sort === item.key ? "bg-primary-100 text-ink" : "text-soft hover:bg-wash hover:text-ink",
            )}
          >
            {item.label}
          </button>
        ))}
        {showDistance && (
          <button
            type="button"
            aria-pressed={sort === "distance"}
            disabled={geoStatus === "loading"}
            onClick={() => onSortChange("distance")}
            title={
              geoStatus === "denied"
                ? "위치 정보를 가져오지 못했어요 — 브라우저 위치 권한을 확인해 주세요."
                : "브라우저 위치 권한을 사용해 가까운 순으로 보여줘요(권역 단위 근사치)."
            }
            className={cn(
              "min-h-11 px-3 py-2 text-sm font-bold transition-colors disabled:cursor-wait disabled:opacity-60",
              sort === "distance" ? "bg-primary-100 text-ink" : "text-soft hover:bg-wash hover:text-ink",
            )}
          >
            {geoStatus === "loading" ? "위치 확인 중…" : "가까운순"}
          </button>
        )}
      </div>
      {showDistance && geoStatus === "denied" && (
        <p className="basis-full text-[0.79rem] text-coral">
          위치 정보를 가져오지 못했어요. 브라우저 위치 권한을 허용한 뒤 다시 눌러 주세요.
        </p>
      )}
    </div>
  );
}

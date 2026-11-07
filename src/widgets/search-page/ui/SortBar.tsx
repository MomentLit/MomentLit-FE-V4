"use client";

import { cn } from "@/shared/lib";
import { REGION_LABELS, type Region } from "@/entities/region";
import { SPACE_CATEGORY_LABELS, type SpaceCategory } from "@/entities/space-category";
import type { SearchMode, SortKey } from "../lib/constants";
import { SearchModeTabs } from "./SearchModeTabs";

interface SortBarProps {
  categories: SpaceCategory[];
  regions: Region[];
  totalElements: number;
  sort: SortKey;
  onSortChange: (sort: SortKey) => void;
  geoStatus: "idle" | "loading" | "denied";
  /** 결과 제목 자리의 "공간 / 팝업" 탭. */
  mode: SearchMode;
  onModeChange: (mode: SearchMode) => void;
  /** "가까운순" 버튼 노출 여부. 팝업은 응답에 좌표가 없어 주소를 지오코딩해 클라이언트에서 정렬한다. */
  showDistance?: boolean;
}

const SORT_ITEMS: { key: SortKey; label: string }[] = [
  { key: "latest", label: "최신순" },
  { key: "popular", label: "인기순" },
];

/**
 * 결과 머리 — 왼쪽은 "공간 / 팝업" 탭(결과 제목을 겸함), 오른쪽은 정렬. 지역·카테고리를 골랐으면 탭 아래에
 * 어떤 조건의 결과인지 작게 적는다. "가까운순"은 브라우저 위치 권한을 받아 거리순으로 다시 검색한다.
 */
export function SortBar({
  categories,
  regions,
  totalElements,
  sort,
  onSortChange,
  geoStatus,
  mode,
  onModeChange,
  showDistance = true,
}: SortBarProps) {
  const labelParts = [
    regions.map((region) => REGION_LABELS[region]).join(", "),
    categories.map((category) => SPACE_CATEGORY_LABELS[category]).join(", "),
  ].filter(Boolean);

  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line app-gutter pb-3 pt-5">
      <div className="flex min-w-0 flex-col gap-1.5">
        <h2 className="sr-only">
          {mode === "space" ? "공간" : "팝업"} 검색 결과 {totalElements}{mode === "space" ? "곳" : "개"}
        </h2>
        <SearchModeTabs mode={mode} onChange={onModeChange} count={totalElements} />
        {labelParts.length > 0 && <p className="truncate text-[0.8rem] text-soft">{labelParts.join(" · ")} 조건</p>}
      </div>
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

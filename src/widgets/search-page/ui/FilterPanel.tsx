import { REGIONS, REGION_LABELS, type Region } from "@/entities/region";
import {
  SPACE_CATEGORIES,
  SPACE_CATEGORY_COLORS,
  SPACE_CATEGORY_LABELS,
  type SpaceCategory,
} from "@/entities/space-category";
import type { SpaceCategoryCount, SpaceRegionCount, UsageUnit } from "@/entities/space";
import { CAPACITY_MAX, CAPACITY_MIN } from "../lib/constants";
import { TONE_DOT_BG } from "./tone-dot";

interface FilterPanelProps {
  categoryCounts: SpaceCategoryCount[];
  regionCounts: SpaceRegionCount[];
  selectedCategories: SpaceCategory[];
  onSelectCategory: (category: SpaceCategory) => void;
  selectedRegions: Region[];
  onSelectRegion: (region: Region) => void;
  maxCapacity: number;
  onMaxCapacityChange: (value: number) => void;
  usageUnits: Record<UsageUnit, boolean>;
  onToggleUsageUnit: (unit: UsageUnit) => void;
  date: string | null;
  onDateChange: (date: string | null) => void;
}

const USAGE_UNIT_LABELS: Record<UsageUnit, string> = { HOURLY: "시간 단위", DAILY: "일 단위" };
const USAGE_UNITS = Object.keys(USAGE_UNIT_LABELS) as UsageUnit[];

/** Region and category checkboxes independently support multiple selections. */
export function FilterPanel({
  categoryCounts,
  regionCounts,
  selectedCategories,
  onSelectCategory,
  selectedRegions,
  onSelectRegion,
  maxCapacity,
  onMaxCapacityChange,
  usageUnits,
  onToggleUsageUnit,
  date,
  onDateChange,
}: FilterPanelProps) {
  const regionCountMap = new Map(regionCounts.map((entry) => [entry.region, entry.count]));
  const categoryCountMap = new Map(categoryCounts.map((entry) => [entry.category, entry.count]));

  return (
    <>
      <div className="flex flex-col gap-2.5">
        <span className="flex items-center justify-between border-b border-line pb-2 text-base font-bold tracking-tight text-ink">
          날짜
          {date && (
            <button type="button" onClick={() => onDateChange(null)} className="normal-case text-ink hover:underline">
              초기화
            </button>
          )}
        </span>
        <input
          type="date"
          value={date ?? ""}
          min={new Date().toISOString().slice(0, 10)}
          onChange={(e) => onDateChange(e.target.value || null)}
          aria-label="날짜"
          className="border border-line px-2.5 py-2 text-[0.86rem] text-ink outline-none focus:border-sky"
        />
        {date && <span className="text-[0.76rem] text-soft">이 날짜에 정기적으로 여는 공간만 보여요.</span>}
      </div>

      <div className="flex flex-col gap-2.5">
        <span className="border-b border-line pb-2 text-base font-bold tracking-tight text-ink">
          지역
        </span>
        {REGIONS.map((region) => (
          <label key={region} className="flex cursor-pointer items-center gap-2.5 text-[0.86rem]">
            <input
              type="checkbox"
              checked={selectedRegions.includes(region)}
              onChange={() => onSelectRegion(region)}
              className="h-[15px] w-[15px] flex-none accent-sky"
            />
            <span className="flex-1 min-w-0 text-ink">{REGION_LABELS[region]}</span>
            <em className="font-mono text-[0.68rem] not-italic text-soft">{regionCountMap.get(region) ?? 0}</em>
          </label>
        ))}
      </div>

      <div className="flex flex-col gap-2.5">
        <span className="border-b border-line pb-2 text-base font-bold tracking-tight text-ink">
          카테고리
        </span>
        {SPACE_CATEGORIES.map((category) => (
          <label key={category} className="flex cursor-pointer items-center gap-2.5 text-[0.86rem]">
            <input
              type="checkbox"
              checked={selectedCategories.includes(category)}
              onChange={() => onSelectCategory(category)}
              className="h-[15px] w-[15px] flex-none accent-sky"
            />
            <i
              className={`block h-2 w-2 flex-none ${TONE_DOT_BG[SPACE_CATEGORY_COLORS[category]]}`}
              aria-hidden="true"
            />
            <span className="flex-1 min-w-0 text-ink">{SPACE_CATEGORY_LABELS[category]}</span>
            <em className="font-mono text-[0.68rem] not-italic text-soft">{categoryCountMap.get(category) ?? 0}</em>
          </label>
        ))}
      </div>

      <div className="flex flex-col gap-2.5">
        <span className="border-b border-line pb-2 text-base font-bold tracking-tight text-ink">
          수용 인원
        </span>
        <input
          type="range"
          min={CAPACITY_MIN}
          max={CAPACITY_MAX}
          value={maxCapacity}
          onChange={(e) => onMaxCapacityChange(Number(e.target.value))}
          aria-label="수용 인원"
          className="w-full accent-sky"
        />
        <span className="font-mono text-[0.74rem] text-soft">
          {maxCapacity >= CAPACITY_MAX ? "인원 제한 없음" : `${CAPACITY_MIN} — ${maxCapacity}인`}
        </span>
      </div>

      <div className="flex flex-col gap-2.5">
        <span className="border-b border-line pb-2 text-base font-bold tracking-tight text-ink">
          이용 단위
        </span>
        {USAGE_UNITS.map((unit) => (
          <label key={unit} className="flex cursor-pointer items-center gap-2.5 text-[0.86rem]">
            <input
              type="checkbox"
              checked={usageUnits[unit]}
              onChange={() => onToggleUsageUnit(unit)}
              className="h-[15px] w-[15px] flex-none accent-sky"
            />
            <span className="flex-1 min-w-0 text-ink">{USAGE_UNIT_LABELS[unit]}</span>
          </label>
        ))}
      </div>
    </>
  );
}

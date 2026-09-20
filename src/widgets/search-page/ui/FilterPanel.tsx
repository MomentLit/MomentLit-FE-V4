"use client";

import { IconX } from "@tabler/icons-react";
import { cn } from "@/shared/lib";
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
  selectedCategory: SpaceCategory | null;
  onSelectCategory: (category: SpaceCategory | null) => void;
  selectedRegion: Region | null;
  onSelectRegion: (region: Region | null) => void;
  maxCapacity: number;
  onMaxCapacityChange: (value: number) => void;
  usageUnits: Record<UsageUnit, boolean>;
  onToggleUsageUnit: (unit: UsageUnit) => void;
  date: string | null;
  onDateChange: (date: string | null) => void;
  onResetAll: () => void;
  /** 모바일 전용 — 데스크톱(sm 이상)에서는 항상 보여서 무시된다. */
  isMobileOpen: boolean;
  onMobileClose: () => void;
}

const USAGE_UNIT_LABELS: Record<UsageUnit, string> = { HOURLY: "시간 단위", DAILY: "일 단위" };
const USAGE_UNITS = Object.keys(USAGE_UNIT_LABELS) as UsageUnit[];

/**
 * Left filter panel — region/category/capacity/usage-unit wired to real
 * counts and to `SearchPageContent`'s query params. `searchSpaces` only
 * accepts a single `category`/`region` value each, so despite the checkbox
 * look, picking one clears any previous pick (radio semantics).
 */
export function FilterPanel({
  categoryCounts,
  regionCounts,
  selectedCategory,
  onSelectCategory,
  selectedRegion,
  onSelectRegion,
  maxCapacity,
  onMaxCapacityChange,
  usageUnits,
  onToggleUsageUnit,
  date,
  onDateChange,
  onResetAll,
  isMobileOpen,
  onMobileClose,
}: FilterPanelProps) {
  const regionCountMap = new Map(regionCounts.map((entry) => [entry.region, entry.count]));
  const categoryCountMap = new Map(categoryCounts.map((entry) => [entry.category, entry.count]));
  const hasAnyFilter =
    selectedCategory !== null || selectedRegion !== null || date !== null || maxCapacity < CAPACITY_MAX;

  return (
    <>
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-ink/30 sm:hidden"
          aria-hidden="true"
          onClick={onMobileClose}
        />
      )}
      <aside
        className={cn(
          "z-50 flex w-[246px] flex-none flex-col gap-6 overflow-y-auto border-r border-line bg-white px-4.5 py-5",
          "sm:static sm:flex sm:w-[246px] sm:max-w-none",
          isMobileOpen ? "fixed inset-y-0 left-0 flex w-[82vw] max-w-[320px]" : "hidden",
        )}
      >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-ink">필터</h2>
        <div className="flex items-center gap-3">
          {hasAnyFilter && (
            <button type="button" onClick={onResetAll} className="text-xs font-bold text-soft hover:text-ink hover:underline">
              전체 초기화
            </button>
          )}
          <button type="button" onClick={onMobileClose} aria-label="필터 닫기" className="text-ink sm:hidden">
            <IconX size={18} stroke={2} />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <span className="flex items-center justify-between border-b border-line pb-2 text-[0.66rem] font-medium uppercase tracking-[0.18em] text-soft">
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
        <span className="border-b border-line pb-2 text-[0.66rem] font-medium uppercase tracking-[0.18em] text-soft">
          지역
        </span>
        {REGIONS.map((region) => (
          <label key={region} className="flex cursor-pointer items-center gap-2.5 text-[0.86rem]">
            <input
              type="checkbox"
              checked={selectedRegion === region}
              onChange={() => onSelectRegion(selectedRegion === region ? null : region)}
              className="h-[15px] w-[15px] flex-none accent-sky"
            />
            <span className="flex-1 min-w-0 text-ink">{REGION_LABELS[region]}</span>
            <em className="font-mono text-[0.68rem] not-italic text-soft">{regionCountMap.get(region) ?? 0}</em>
          </label>
        ))}
      </div>

      <div className="flex flex-col gap-2.5">
        <span className="border-b border-line pb-2 text-[0.66rem] font-medium uppercase tracking-[0.18em] text-soft">
          카테고리
        </span>
        {SPACE_CATEGORIES.map((category) => (
          <label key={category} className="flex cursor-pointer items-center gap-2.5 text-[0.86rem]">
            <input
              type="checkbox"
              checked={selectedCategory === category}
              onChange={() => onSelectCategory(selectedCategory === category ? null : category)}
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
        <span className="border-b border-line pb-2 text-[0.66rem] font-medium uppercase tracking-[0.18em] text-soft">
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
        <span className="border-b border-line pb-2 text-[0.66rem] font-medium uppercase tracking-[0.18em] text-soft">
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
      </aside>
    </>
  );
}

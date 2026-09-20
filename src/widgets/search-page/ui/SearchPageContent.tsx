"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { IconFilter } from "@tabler/icons-react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { fetchCategoryCounts, fetchRegionCounts, searchSpaces } from "@/entities/space/api";
import type { UsageUnit } from "@/entities/space";
import type { Region } from "@/entities/region";
import type { SpaceCategory } from "@/entities/space-category";
import { getErrorMessage } from "@/shared/api/error";
import { CAPACITY_MAX, PAGE_SIZE, type SortKey } from "../lib/constants";
import { FilterPanel } from "./FilterPanel";
import { SortBar } from "./SortBar";
import { ResultList } from "./ResultList";
import { Pagination } from "./Pagination";

const SORT_PARAM: Record<SortKey, string | undefined> = {
  latest: undefined, // backend default: createdAt,desc
  popular: "likeCount,desc",
  distance: undefined, // lat/lng가 대신 sort 역할을 한다 — 백엔드가 이 값보다 우선한다.
};

/**
 * Search results screen — left filter panel + sort/results/pagination, all
 * wired to `searchSpaces`/`fetchCategoryCounts`/`fetchRegionCounts` against
 * the real backend. Filter/sort/page state lives here and is handed down to
 * the (mostly presentational) child widgets.
 */
export function SearchPageContent() {
  // 홈 화면 콤보 검색(`ComboSearch`)에서 "찾아보기"로 넘어올 때 쿼리 파라미터로 필터를 미리
  // 채워준다 — 이후 이 페이지 안에서의 필터 변경은 URL과 다시 동기화하지 않는 로컬 상태다.
  const initialParams = useSearchParams();
  const [category, setCategory] = useState<SpaceCategory | null>(
    () => (initialParams.get("category") as SpaceCategory | null) ?? null,
  );
  const [region, setRegion] = useState<Region | null>(() => (initialParams.get("region") as Region | null) ?? null);
  const [date, setDate] = useState<string | null>(() => initialParams.get("date") ?? null);
  const [maxCapacity, setMaxCapacity] = useState(CAPACITY_MAX);
  const [usageUnits, setUsageUnits] = useState<Record<UsageUnit, boolean>>({ HOURLY: true, DAILY: true });
  const [sort, setSort] = useState<SortKey>("latest");
  const [page, setPage] = useState(0);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoStatus, setGeoStatus] = useState<"idle" | "loading" | "denied">("idle");

  // Any filter/sort change invalidates the current page — reset it right in the handler
  // (not via a `useEffect`, which would just cause an extra render for the same result).
  function selectCategory(next: SpaceCategory | null) {
    setCategory(next);
    setPage(0);
  }

  function selectRegion(next: Region | null) {
    setRegion(next);
    setPage(0);
  }

  function changeDate(next: string | null) {
    setDate(next);
    setPage(0);
  }

  function changeMaxCapacity(value: number) {
    setMaxCapacity(value);
    setPage(0);
  }

  function toggleUsageUnit(unit: UsageUnit) {
    setUsageUnits((prev) => ({ ...prev, [unit]: !prev[unit] }));
    setPage(0);
  }

  function changeSort(next: SortKey) {
    if (next === "distance" && !coords) {
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        setGeoStatus("denied");
        return;
      }
      setGeoStatus("loading");
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
          setGeoStatus("idle");
          setSort("distance");
          setPage(0);
        },
        () => setGeoStatus("denied"),
        { timeout: 8000 },
      );
      return;
    }
    setSort(next);
    setPage(0);
  }

  function resetAllFilters() {
    setCategory(null);
    setRegion(null);
    setDate(null);
    setMaxCapacity(CAPACITY_MAX);
    setUsageUnits({ HOURLY: true, DAILY: true });
    setPage(0);
  }

  const hasAnyFilter = category !== null || region !== null || date !== null || maxCapacity < CAPACITY_MAX;

  // `searchSpaces` takes a single usageUnit value; both-checked or both-unchecked both mean "no filter".
  const usageUnit: UsageUnit | undefined =
    usageUnits.HOURLY === usageUnits.DAILY ? undefined : usageUnits.HOURLY ? "HOURLY" : "DAILY";

  const useDistanceSort = sort === "distance" && coords !== null;

  const searchParams = {
    page,
    size: PAGE_SIZE,
    sort: useDistanceSort ? undefined : SORT_PARAM[sort],
    category: category ?? undefined,
    region: region ?? undefined,
    usageUnit,
    maxCapacity: maxCapacity < CAPACITY_MAX ? maxCapacity : undefined,
    date: date ?? undefined,
    lat: useDistanceSort ? coords.lat : undefined,
    lng: useDistanceSort ? coords.lng : undefined,
  };

  const { data: categoryCountsData } = useQuery({
    queryKey: ["spaces", "counts", "by-category"],
    queryFn: fetchCategoryCounts,
  });

  const { data: regionCountsData } = useQuery({
    queryKey: ["spaces", "counts", "by-region"],
    queryFn: fetchRegionCounts,
  });

  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
  } = useQuery({
    queryKey: ["spaces", "search", searchParams],
    queryFn: () => searchSpaces(searchParams),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="flex min-h-full flex-1 flex-col sm:flex-row">
      <FilterPanel
        categoryCounts={categoryCountsData ?? []}
        regionCounts={regionCountsData ?? []}
        selectedCategory={category}
        onSelectCategory={selectCategory}
        selectedRegion={region}
        onSelectRegion={selectRegion}
        maxCapacity={maxCapacity}
        onMaxCapacityChange={changeMaxCapacity}
        usageUnits={usageUnits}
        onToggleUsageUnit={toggleUsageUnit}
        date={date}
        onDateChange={changeDate}
        onResetAll={resetAllFilters}
        isMobileOpen={mobileFilterOpen}
        onMobileClose={() => setMobileFilterOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <button
          type="button"
          onClick={() => setMobileFilterOpen(true)}
          className="flex items-center gap-1.5 border-b border-line px-4 py-2.5 text-sm font-bold text-ink sm:hidden"
        >
          <IconFilter size={15} stroke={2} aria-hidden />
          필터{hasAnyFilter && <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-coral" aria-hidden />}
        </button>
        <SortBar
          category={category}
          region={region}
          totalElements={data?.totalElements ?? 0}
          sort={sort}
          onSortChange={changeSort}
          geoStatus={geoStatus}
        />
        <ResultList
          items={data?.content ?? []}
          isLoading={isLoading}
          isError={isError}
          errorMessage={isError ? getErrorMessage(error) : undefined}
        />
        <Pagination
          page={data?.page ?? page}
          totalPages={data?.totalPages ?? 0}
          onPageChange={setPage}
          disabled={isFetching}
        />
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { IconFilter, IconX } from "@tabler/icons-react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { fetchCategoryCounts, fetchRegionCounts, searchSpaces } from "@/entities/space/api";
import type { UsageUnit } from "@/entities/space";
import type { Region } from "@/entities/region";
import type { SpaceCategory } from "@/entities/space-category";
import { fetchPopups } from "@/entities/popup";
import { getErrorMessage } from "@/shared/api/error";
import { cn } from "@/shared/lib";
import { CAPACITY_MAX, PAGE_SIZE, POPUP_SEARCH_FETCH_SIZE, type SearchMode, type SortKey } from "../lib/constants";
import { matchesRegion, isPopupOpenOnDate, guessPopupCategory, type PopupCategory } from "../lib/popup-filters";
import { SearchBar } from "./SearchBar";
import { SearchModeToggle } from "./SearchModeToggle";
import { FilterPanel } from "./FilterPanel";
import { PopupFilterPanel } from "./PopupFilterPanel";
import { SortBar } from "./SortBar";
import { ResultList } from "./ResultList";
import { PopupResultList } from "./PopupResultList";
import { Pagination } from "./Pagination";

const NAME_DEBOUNCE_MS = 350;

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
  const [mode, setMode] = useState<SearchMode>("space");
  const [category, setCategory] = useState<SpaceCategory | null>(
    () => (initialParams.get("category") as SpaceCategory | null) ?? null,
  );
  const [region, setRegion] = useState<Region | null>(() => (initialParams.get("region") as Region | null) ?? null);
  const [popupCategory, setPopupCategory] = useState<PopupCategory | null>(null);
  const [date, setDate] = useState<string | null>(() => initialParams.get("date") ?? null);
  const [nameInput, setNameInput] = useState(() => initialParams.get("name") ?? "");
  const [name, setName] = useState(nameInput);
  const [maxCapacity, setMaxCapacity] = useState(CAPACITY_MAX);
  const [usageUnits, setUsageUnits] = useState<Record<UsageUnit, boolean>>({ HOURLY: true, DAILY: true });
  const [sort, setSort] = useState<SortKey>("latest");
  const [page, setPage] = useState(0);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoStatus, setGeoStatus] = useState<"idle" | "loading" | "denied">("idle");

  function changeMode(next: SearchMode) {
    setMode(next);
    setPage(0);
  }

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

  function selectPopupCategory(next: PopupCategory | null) {
    setPopupCategory(next);
    setPage(0);
  }

  function changeDate(next: string | null) {
    setDate(next);
    setPage(0);
  }

  // Debounced separately from the other filters (which reset the page synchronously
  // in their own handler) — a keyword commits only once typing pauses, so the page
  // reset has to live in the same effect that commits `name`, not in `setNameInput`.
  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = nameInput.trim();
      setName((prev) => (prev === trimmed ? prev : trimmed));
      setPage(0);
    }, NAME_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [nameInput]);

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
    setPopupCategory(null);
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
    name: name || undefined,
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
    enabled: mode === "space",
    placeholderData: keepPreviousData,
  });

  // `GET /popups` has no keyword/region/category/date filters (unlike spaces' `name`/
  // `region`/`category`/`date`), so any active filter fetches one bigger batch and
  // filters client-side instead of paging the backend — see POPUP_SEARCH_FETCH_SIZE
  // and ../lib/popup-filters. `page`/pagination controls are meaningless in that state.
  const popupKeyword = name.trim().toLowerCase();
  const hasActivePopupFilter = popupKeyword.length > 0 || region !== null || popupCategory !== null || date !== null;
  const popupFetchPage = hasActivePopupFilter ? 0 : page;
  const popupFetchSize = hasActivePopupFilter ? POPUP_SEARCH_FETCH_SIZE : PAGE_SIZE;

  const {
    data: popupData,
    isLoading: isPopupLoading,
    isFetching: isPopupFetching,
    isError: isPopupError,
    error: popupError,
  } = useQuery({
    queryKey: ["popups", "search", { page: popupFetchPage, size: popupFetchSize }],
    queryFn: () => fetchPopups({ page: popupFetchPage, size: popupFetchSize }),
    enabled: mode === "popup",
    placeholderData: keepPreviousData,
  });

  const popupItems = popupData?.content ?? [];
  const filteredPopups = popupItems.filter((popup) => {
    if (popupKeyword && !popup.title.toLowerCase().includes(popupKeyword)) return false;
    if (region && !matchesRegion(popup.address.sido, region)) return false;
    if (popupCategory && guessPopupCategory(popup.title) !== popupCategory) return false;
    if (date && !isPopupOpenOnDate(popup, date)) return false;
    return true;
  });
  const sortedPopups =
    sort === "popular" ? [...filteredPopups].sort((a, b) => b.like_count - a.like_count) : filteredPopups;
  const popupTotalElements = hasActivePopupFilter ? sortedPopups.length : (popupData?.totalElements ?? 0);
  const hasAnyPopupFilter = region !== null || popupCategory !== null || date !== null;

  const hasAnyActiveFilter = mode === "space" ? hasAnyFilter : hasAnyPopupFilter;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <div className="flex flex-1 flex-col sm:flex-row">
        {mobileFilterOpen && (
          <div
            className="fixed inset-0 z-40 bg-ink/30 sm:hidden"
            aria-hidden="true"
            onClick={() => setMobileFilterOpen(false)}
          />
        )}
        {/*
          Single persistent aside — NOT swapped per mode — so SearchModeToggle
          keeps the same DOM node across a space/popup switch and its slide
          animation has something to transition from. Only the field group
          below it (FilterPanel vs PopupFilterPanel) changes.
        */}
        <aside
          className={cn(
            "z-50 flex w-[246px] flex-none flex-col gap-6 overflow-y-auto border-r border-line bg-white px-4.5 py-5",
            "sm:static sm:flex sm:w-[246px] sm:max-w-none",
            mobileFilterOpen ? "fixed inset-y-0 left-0 flex w-[82vw] max-w-[320px]" : "hidden",
          )}
        >
          <SearchModeToggle mode={mode} onChange={changeMode} />

          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-ink">필터</h2>
            <div className="flex items-center gap-3">
              {hasAnyActiveFilter && (
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="text-xs font-bold text-soft hover:text-ink hover:underline"
                >
                  전체 초기화
                </button>
              )}
              <button
                type="button"
                onClick={() => setMobileFilterOpen(false)}
                aria-label="필터 닫기"
                className="text-ink sm:hidden"
              >
                <IconX size={18} stroke={2} />
              </button>
            </div>
          </div>

          {mode === "space" ? (
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
            />
          ) : (
            <PopupFilterPanel
              selectedRegion={region}
              onSelectRegion={selectRegion}
              selectedCategory={popupCategory}
              onSelectCategory={selectPopupCategory}
              date={date}
              onDateChange={changeDate}
            />
          )}
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <SearchBar
            value={nameInput}
            onChange={setNameInput}
            placeholder={mode === "space" ? "공간 이름으로 검색" : "팝업 이름으로 검색"}
          />
          <button
            type="button"
            onClick={() => setMobileFilterOpen(true)}
            className="flex items-center gap-1.5 border-b border-line px-4 py-2.5 text-sm font-bold text-ink sm:hidden"
          >
            <IconFilter size={15} stroke={2} aria-hidden />
            필터
            {hasAnyActiveFilter && (
              <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-coral" aria-hidden />
            )}
          </button>
          {mode === "space" ? (
            <>
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
            </>
          ) : (
            <>
              <SortBar
                category={null}
                region={null}
                totalElements={popupTotalElements}
                sort={sort}
                onSortChange={changeSort}
                geoStatus={geoStatus}
                itemLabel="팝업"
                unitLabel="개"
                showDistance={false}
              />
              <PopupResultList
                items={sortedPopups}
                isLoading={isPopupLoading}
                isError={isPopupError}
                errorMessage={isPopupError ? getErrorMessage(popupError) : undefined}
                emptyMessage={hasActivePopupFilter ? "조건에 맞는 팝업이 없어요." : "아직 등록된 팝업이 없어요."}
              />
              <Pagination
                page={hasActivePopupFilter ? 0 : (popupData?.page ?? page)}
                totalPages={hasActivePopupFilter ? 1 : (popupData?.totalPages ?? 0)}
                onPageChange={setPage}
                disabled={isPopupFetching}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

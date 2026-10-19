"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { IconFilter, IconX } from "@tabler/icons-react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSpaceDisplayCounts } from "@/entities/space/queries";
import type { UsageUnit } from "@/entities/space";
import { REGIONS, type Region } from "@/entities/region";
import { SPACE_CATEGORIES, type SpaceCategory } from "@/entities/space-category";
import { collectPages, searchSelectedSpaces, toggleSelection } from "../lib/multi-search";
import { fetchPopups, type PopupListItem } from "@/entities/popup";
import { distanceKm, geocodeAddress, type Coordinates } from "@/widgets/map/lib/geocode";
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

function popupAddress(popup: PopupListItem): string {
  return popup.address.road_address || popup.address.jibun_address || "";
}

const SORT_PARAM: Record<SortKey, string | undefined> = {
  latest: undefined, // backend default: createdAt,desc
  popular: "likeCount,desc",
  distance: undefined, // lat/lng가 대신 sort 역할을 한다 — 백엔드가 이 값보다 우선한다.
};

/**
 * Search results screen — left filter panel + sort/results/pagination, all
 * wired to grouped search results and counts from the real backend.
 * Filter/sort/page state lives here and is handed down to
 * the (mostly presentational) child widgets.
 */
export function SearchPageContent() {
  // 홈 화면 콤보 검색(`ComboSearch`)에서 "검색하기"로 넘어올 때 쿼리 파라미터로 필터를 미리
  // 채워준다 — 이후 이 페이지 안에서의 필터 변경은 URL과 다시 동기화하지 않는 로컬 상태다.
  const initialParams = useSearchParams();
  const [mode, setMode] = useState<SearchMode>(() => initialParams.get("mode") === "popup" ? "popup" : "space");
  const requestedMode = initialParams.get("mode") === "popup" ? "popup" : "space";
  const [categories, setCategories] = useState<SpaceCategory[]>(() =>
    initialParams.getAll("category").filter((value): value is SpaceCategory => SPACE_CATEGORIES.includes(value as SpaceCategory)),
  );
  const [regions, setRegions] = useState<Region[]>(() =>
    initialParams.getAll("region").filter((value): value is Region => REGIONS.includes(value as Region)),
  );
  const [popupCategories, setPopupCategories] = useState<PopupCategory[]>([]);
  const [date, setDate] = useState<string | null>(() => initialParams.get("date") ?? null);
  const [nameInput, setNameInput] = useState(() => initialParams.get("name") ?? "");
  const [name, setName] = useState(nameInput);
  const [maxCapacity, setMaxCapacity] = useState(CAPACITY_MAX);
  const [usageUnits, setUsageUnits] = useState<Record<UsageUnit, boolean>>({ HOURLY: true, DAILY: true });
  const [sort, setSort] = useState<SortKey>("latest");
  const [page, setPage] = useState(0);
  useEffect(() => {
    queueMicrotask(() => { setMode(requestedMode); setPage(0); });
  }, [requestedMode]);

  const queryClient = useQueryClient();
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoStatus, setGeoStatus] = useState<"idle" | "loading" | "denied">("idle");

  function changeMode(next: SearchMode) {
    setMode(next);
    setPage(0);
  }

  // Any filter/sort change invalidates the current page — reset it right in the handler
  // (not via a `useEffect`, which would just cause an extra render for the same result).
  function selectCategory(next: SpaceCategory) {
    setCategories((prev) => toggleSelection(prev, next));
    setPage(0);
  }

  function selectRegion(next: Region) {
    setRegions((prev) => toggleSelection(prev, next));
    setPage(0);
  }

  function selectPopupCategory(next: PopupCategory) {
    setPopupCategories((prev) => toggleSelection(prev, next));
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
    setCategories([]);
    setRegions([]);
    setPopupCategories([]);
    setDate(null);
    setMaxCapacity(CAPACITY_MAX);
    setUsageUnits({ HOURLY: true, DAILY: true });
    setPage(0);
  }

  const hasAnyFilter = categories.length > 0 || regions.length > 0 || date !== null || maxCapacity < CAPACITY_MAX;

  // `searchSpaces` takes a single usageUnit value; both-checked or both-unchecked both mean "no filter".
  const usageUnit: UsageUnit | undefined =
    usageUnits.HOURLY === usageUnits.DAILY ? undefined : usageUnits.HOURLY ? "HOURLY" : "DAILY";

  const useDistanceSort = sort === "distance" && coords !== null;

  const searchParams = {
    sort: useDistanceSort ? undefined : SORT_PARAM[sort],
    name: name || undefined,
    usageUnit,
    maxCapacity: maxCapacity < CAPACITY_MAX ? maxCapacity : undefined,
    date: date ?? undefined,
    lat: useDistanceSort ? coords.lat : undefined,
    lng: useDistanceSort ? coords.lng : undefined,
  };

  const { data: displayCounts } = useSpaceDisplayCounts();
  const categoryCountsData = displayCounts?.byCategory;
  const regionCountsData = displayCounts?.byRegion;

  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
  } = useQuery({
    queryKey: ["spaces", "search", searchParams, regions, categories],
    queryFn: ({ signal }) => searchSelectedSpaces(searchParams, regions, categories, signal),
    enabled: mode === "space",
    placeholderData: keepPreviousData,
  });

  // The query groups every matching page once; page changes reuse that complete snapshot.
  const spaceTotalElements = data?.length ?? 0;
  const spaceTotalPages = Math.ceil(spaceTotalElements / PAGE_SIZE);
  const spacePage = Math.min(page, Math.max(0, spaceTotalPages - 1));
  const spaceItems = data?.slice(spacePage * PAGE_SIZE, (spacePage + 1) * PAGE_SIZE) ?? [];

  // Popup filters run over all server pages so multi-selection never drops later matches.
  const popupKeyword = name.trim().toLowerCase();
  // 팝업 거리순은 서버가 지원하지 않아 전체를 받아 클라이언트에서 정렬한다 — 그래서 필터와 같은 "전체 조회" 경로를 탄다.
  const hasActivePopupFilter =
    popupKeyword.length > 0 || regions.length > 0 || popupCategories.length > 0 || date !== null || useDistanceSort;
  const popupFetchPage = hasActivePopupFilter ? 0 : page;
  const popupFetchSize = hasActivePopupFilter ? POPUP_SEARCH_FETCH_SIZE : PAGE_SIZE;

  const {
    data: popupData,
    isLoading: isPopupLoading,
    isFetching: isPopupFetching,
    isError: isPopupError,
    error: popupError,
  } = useQuery({
    queryKey: ["popups", "search", { page: popupFetchPage, size: popupFetchSize, all: hasActivePopupFilter }],
    queryFn: async ({ signal }) => {
      if (!hasActivePopupFilter) return fetchPopups({ page: popupFetchPage, size: popupFetchSize }, signal);
      const content = await collectPages((page) => fetchPopups({ page, size: popupFetchSize }, signal));
      return { content, page: 0, size: content.length, totalElements: content.length, totalPages: 1 };
    },
    enabled: mode === "popup",
    placeholderData: keepPreviousData,
  });

  const popupItems = popupData?.content ?? [];
  const filteredPopups = popupItems.filter((popup) => {
    if (popupKeyword && !popup.title.toLowerCase().includes(popupKeyword)) return false;
    if (regions.length > 0 && !regions.some((region) => matchesRegion(popup.address.sido, region))) return false;
    if (popupCategories.length > 0 && !popupCategories.includes(guessPopupCategory(popup.title))) return false;
    if (date && !isPopupOpenOnDate(popup, date)) return false;
    return true;
  });

  // 팝업 응답엔 좌표가 없어서, 주소를 카카오 지오코더로 좌표화해 내 위치와의 직선 거리로 정렬한다.
  const popupAddresses = useDistanceSort
    ? [...new Set(filteredPopups.map(popupAddress).filter((address) => address.length > 0))].sort()
    : [];
  const { data: popupCoords, isLoading: isPopupGeocoding } = useQuery({
    queryKey: ["popups", "geocode", popupAddresses],
    enabled: mode === "popup" && useDistanceSort && popupAddresses.length > 0,
    retry: false,
    queryFn: async ({ signal }) => {
      const located: Record<string, Coordinates | null> = {};
      for (let start = 0; start < popupAddresses.length; start += 4) {
        await Promise.all(popupAddresses.slice(start, start + 4).map(async (address) => {
          try {
            located[address] = await queryClient.fetchQuery({
              queryKey: ["address", "geocode", address],
              queryFn: () => geocodeAddress(address, signal),
              staleTime: 24 * 60 * 60 * 1000,
              retry: false,
            });
          } catch (geocodeError) {
            if (signal.aborted) throw geocodeError;
            located[address] = null;
          }
        }));
      }
      return located;
    },
    placeholderData: keepPreviousData,
  });

  function popupDistance(popup: PopupListItem): number {
    const here = coords ? { latitude: coords.lat, longitude: coords.lng } : null;
    const there = popupCoords?.[popupAddress(popup)];
    // 좌표를 못 찾은 팝업은 맨 뒤로 보낸다.
    return here && there ? distanceKm(here, there) : Number.POSITIVE_INFINITY;
  }

  const sortedPopups =
    sort === "popular"
      ? [...filteredPopups].sort((a, b) => b.like_count - a.like_count)
      : useDistanceSort
        ? [...filteredPopups].sort((a, b) => popupDistance(a) - popupDistance(b))
        : filteredPopups;
  const popupTotalElements = hasActivePopupFilter ? sortedPopups.length : (popupData?.totalElements ?? 0);
  const hasAnyPopupFilter = regions.length > 0 || popupCategories.length > 0 || date !== null;

  const hasAnyActiveFilter = mode === "space" ? hasAnyFilter : hasAnyPopupFilter;

  return (
    <div className="flex min-h-full min-w-0 flex-1 flex-col">
      <div className="flex flex-1 flex-col lg:flex-row">
        {mobileFilterOpen && (
          <div
            className="fixed inset-0 z-40 bg-ink/30 lg:hidden"
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
            "lg:static lg:flex lg:w-[246px] lg:max-w-none",
            mobileFilterOpen ? "fixed inset-y-0 left-0 flex w-[82vw] max-w-[320px]" : "hidden",
          )}
        >
          <SearchModeToggle mode={mode} onChange={changeMode} />

          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-ink">검색 조건</h2>
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
                aria-label="검색 조건 닫기"
                className="text-ink lg:hidden"
              >
                <IconX size={18} stroke={2} />
              </button>
            </div>
          </div>

          {mode === "space" ? (
            <FilterPanel
              categoryCounts={categoryCountsData ?? []}
              regionCounts={regionCountsData ?? []}
              selectedCategories={categories}
              onSelectCategory={selectCategory}
              selectedRegions={regions}
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
              selectedRegions={regions}
              onSelectRegion={selectRegion}
              selectedCategories={popupCategories}
              onSelectCategory={selectPopupCategory}
              date={date}
              onDateChange={changeDate}
            />
          )}
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="app-gutter border-b border-line py-4 lg:hidden">
            <SearchModeToggle mode={mode} onChange={changeMode} />
          </div>
          <SearchBar
            value={nameInput}
            onChange={setNameInput}
            placeholder={mode === "space" ? "공간 이름으로 검색" : "팝업 이름으로 검색"}
          />
          <button
            type="button"
            onClick={() => setMobileFilterOpen(true)}
            className="flex items-center gap-1.5 border-b border-line px-4 py-2.5 text-sm font-bold text-ink lg:hidden"
          >
            <IconFilter size={15} stroke={2} aria-hidden />
            검색 조건
            {hasAnyActiveFilter && (
              <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-coral" aria-hidden />
            )}
          </button>
          {mode === "space" ? (
            <>
              <SortBar
                categories={categories}
                regions={regions}
                totalElements={spaceTotalElements}
                sort={sort}
                onSortChange={changeSort}
                geoStatus={geoStatus}
              />
              <ResultList
                items={spaceItems}
                isLoading={isLoading}
                isError={isError}
                errorMessage={isError ? getErrorMessage(error) : undefined}
              />
              <Pagination
                page={spacePage}
                totalPages={spaceTotalPages}
                onPageChange={setPage}
                disabled={isFetching}
              />
            </>
          ) : (
            <>
              <SortBar
                categories={[]}
                regions={regions}
                totalElements={popupTotalElements}
                sort={sort}
                onSortChange={changeSort}
                geoStatus={geoStatus}
                itemLabel="팝업"
                unitLabel="개"
              />
              <PopupResultList
                items={hasActivePopupFilter ? sortedPopups.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE) : sortedPopups}
                isLoading={isPopupLoading || isPopupGeocoding}
                isError={isPopupError}
                errorMessage={isPopupError ? getErrorMessage(popupError) : undefined}
                emptyMessage={hasActivePopupFilter ? "조건에 맞는 팝업이 없어요." : "아직 등록된 팝업이 없어요."}
              />
              <Pagination
                page={hasActivePopupFilter ? page : (popupData?.page ?? page)}
                totalPages={hasActivePopupFilter ? Math.ceil(sortedPopups.length / PAGE_SIZE) : (popupData?.totalPages ?? 0)}
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

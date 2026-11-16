import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/entities/auth";
import { fetchSpace, fetchAvailability, fetchBookedDates, fetchMySpaces, searchSpaces } from "@/entities/space/api";
import { splitSpaceOptionName } from "@/entities/space";
import type { DayOfWeek, SpaceAvailabilitySlot, SpaceDetail, SpaceListItem, UsageUnit } from "@/entities/space";
import { fetchSpaceReviews, createSpaceReview } from "@/entities/review";
import type { SpaceReview } from "@/entities/review";
import {
  createMatching,
  fetchBookedTimes,
  fetchHostStats,
  fetchMyMatchings,
} from "@/entities/matching";
import type { BookedTime, HostStats, MatchingCreateRequest, MatchingCreateResponse } from "@/entities/matching";
import { fetchSpaceLikeStatus, likeSpace, unlikeSpace } from "@/entities/like";
import type { LikeStatus } from "@/entities/like";

/** UI label for `usage_unit` — not modeled on the entity itself (display concern only). */
export const USAGE_UNIT_LABELS: Record<UsageUnit, string> = {
  HOURLY: "시간 단위",
  DAILY: "일 단위",
};

/** Maps `Date#getDay()` (0 = Sunday) onto the backend's `DayOfWeek` enum. */
export const JS_DAY_TO_DAY_OF_WEEK: DayOfWeek[] = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
];

export function dayOfWeekForDate(dateStr: string): DayOfWeek {
  const day = new Date(`${dateStr}T00:00:00`).getDay();
  return JS_DAY_TO_DAY_OF_WEEK[day];
}

export function toDateInputValue(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** `"HH:mm"` / `"HH:mm:ss"` → 0시부터 지난 분. */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** 예약 시간 선택기의 슬롯 한 칸 — 승인된 예약과 겹치면 `booked`. */
export interface DaySlot extends SpaceAvailabilitySlot {
  booked: boolean;
}

/** 그 날짜 안에서 승인 예약이 차지하는 [시작, 끝) 분 구간 — 날짜를 넘는 예약은 그날 0시/24시로 자른다. */
function bookedRangesOnDate(date: string, bookedTimes: BookedTime[]): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  for (const booked of bookedTimes) {
    const [startDate, startTime = "00:00"] = booked.start_time.split("T");
    const [endDate, endTime = "00:00"] = booked.end_time.split("T");
    if (startDate > date || endDate < date) continue;
    const start = startDate < date ? 0 : timeToMinutes(startTime);
    const end = endDate > date ? 24 * 60 : timeToMinutes(endTime);
    if (end > start) ranges.push([start, end]);
  }
  return ranges;
}

/** 그 날짜(요일)에 열린 슬롯을 시작 시각 순으로, 이미 찬 슬롯은 `booked` 표시해서 돌려준다. */
export function daySlotsForDate(date: string, availability: SpaceAvailabilitySlot[], bookedTimes: BookedTime[]): DaySlot[] {
  const dayOfWeek = dayOfWeekForDate(date);
  const ranges = bookedRangesOnDate(date, bookedTimes);
  return availability
    .filter((slot) => slot.is_open && slot.day_of_week === dayOfWeek)
    .map((slot) => {
      const start = timeToMinutes(slot.start_time);
      const end = timeToMinutes(slot.end_time);
      return { ...slot, booked: ranges.some(([bookedStart, bookedEnd]) => bookedStart < end && bookedEnd > start) };
    })
    .sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));
}

/** 그 날짜에 아직 비어 있는 슬롯이 하나라도 있으면 true. */
export function isDateOpen(date: string, availability: SpaceAvailabilitySlot[], bookedTimes: BookedTime[]): boolean {
  return daySlotsForDate(date, availability, bookedTimes).some((slot) => !slot.booked);
}

/**
 * 연속 예약에서 고를 수 있는 종료 슬롯들 — 시작 슬롯부터 다음 슬롯이 바로 이어지고(빈 시간 없음)
 * 비어 있는 동안 계속 이어 붙인다. 연속 예약이 꺼져 있으면 시작 슬롯 하나만.
 */
export function consecutiveSlotsFrom(daySlots: DaySlot[], start: DaySlot, allowConsecutive: boolean): DaySlot[] {
  const chain = [start];
  if (!allowConsecutive) return chain;
  let cursor = start;
  for (;;) {
    const next = daySlots.find((slot) => !slot.booked && timeToMinutes(slot.start_time) === timeToMinutes(cursor.end_time));
    if (!next) return chain;
    chain.push(next);
    cursor = next;
  }
}

/** `booked-times`를 못 불러왔을 때 — 예전처럼 승인 예약이 있는 날짜를 하루 통째로 막는다. */
export function bookedDatesToTimes(dates: string[]): BookedTime[] {
  return dates.map((date) => {
    const next = new Date(`${date}T00:00:00`);
    next.setDate(next.getDate() + 1);
    return { start_time: `${date}T00:00:00`, end_time: `${toDateInputValue(next)}T00:00:00` };
  });
}

export function useSpaceQuery(spaceId: number) {
  return useQuery({
    queryKey: ["space", spaceId],
    queryFn: () => fetchSpace(spaceId),
    retry: 1,
    // The server creates the introduction after the space write has completed.
    // Stop immediately once the terminal state is returned, so completed and
    // failed summaries never keep polling in the background.
    refetchInterval: (query) => (query.state.data?.ai_summary_status === "PENDING" ? 3000 : false),
    refetchIntervalInBackground: false,
  });
}

/** 상세 페이지 구역 탭 한 칸 — 같은 공간 안의 다른 구역(자기 자신 포함). */
export interface SpaceOptionSummary {
  spaceId: number;
  label: string;
  /** 가격 문의 구역이면 `null`. */
  pricePerHour: number | null;
  usageUnit: UsageUnit | null;
  capacity: number | null;
}

function toOptionSummary(space: Pick<SpaceListItem, "space_id" | "name" | "price_per_hour" | "usage_unit" | "capacity">): SpaceOptionSummary | null {
  const { optionLabel } = splitSpaceOptionName(space.name);
  if (!optionLabel) return null;
  return {
    spaceId: space.space_id,
    label: optionLabel,
    pricePerHour: space.price_per_hour,
    usageUnit: space.usage_unit,
    capacity: space.capacity,
  };
}

/**
 * 같은 공간의 다른 구역 찾기 — 이름이 `공간 이름 · 구역 이름`이고 도로명 주소가 같은
 * 공간들을 묶는다 (entities/space `splitSpaceOptionName` 참고). 공개 검색은 승인된
 * 공간만 주므로, 호스트 본인이 보는 중이면 내 공간 목록(검토 중인 구역 포함)도 합친다.
 * 구역이 2개 이상일 때만 결과를 돌려주고, 아니면 빈 배열 — 탭을 그리지 않는다.
 */
export function useSpaceOptionsQuery(space: SpaceDetail | undefined) {
  const userId = useAuthStore((state) => state.user?.id);
  const { baseName, optionLabel } = splitSpaceOptionName(space?.name ?? "");
  const isOwner = Boolean(space && userId && space.host_id === userId);
  return useQuery({
    queryKey: ["space-options", baseName, space?.address.road_address, isOwner],
    enabled: Boolean(space && optionLabel),
    queryFn: async ({ signal }): Promise<SpaceOptionSummary[]> => {
      if (!space) return [];
      const [publicPage, myPage] = await Promise.all([
        searchSpaces({ name: baseName, size: 50 }, signal),
        isOwner ? fetchMySpaces({ name: baseName, size: 50 }) : Promise.resolve(null),
      ]);
      const candidates = [space, ...publicPage.content, ...(myPage?.content ?? [])];
      const options = new Map<number, SpaceOptionSummary>();
      for (const candidate of candidates) {
        if (options.has(candidate.space_id)) continue;
        if (splitSpaceOptionName(candidate.name).baseName !== baseName) continue;
        if (candidate.address.road_address !== space.address.road_address) continue;
        const summary = toOptionSummary(candidate);
        if (summary) options.set(candidate.space_id, summary);
      }
      // 등록한 순서(= 등록 폼의 구역 순서)대로.
      const sorted = [...options.values()].sort((a, b) => a.spaceId - b.spaceId);
      return sorted.length > 1 ? sorted : [];
    },
  });
}

export function useAvailabilityQuery(spaceId: number, enabled: boolean) {
  return useQuery({
    queryKey: ["space-availability", spaceId],
    queryFn: () => fetchAvailability(spaceId),
    enabled,
  });
}

export function useBookedTimesQuery(spaceId: number, enabled: boolean) {
  return useQuery({
    queryKey: ["space-booked-times", spaceId],
    queryFn: () => fetchBookedTimes(spaceId),
    enabled,
    retry: 1,
  });
}

/** `useBookedTimesQuery`가 실패했을 때만 켠다(백엔드 배포 전 대비). */
export function useBookedDatesQuery(spaceId: number, enabled: boolean) {
  return useQuery({
    queryKey: ["space-booked-dates", spaceId],
    queryFn: () => fetchBookedDates(spaceId),
    enabled,
  });
}

export function useSpaceReviewsQuery(spaceId: number, enabled: boolean) {
  return useQuery({
    queryKey: ["space-reviews", spaceId],
    queryFn: () => fetchSpaceReviews(spaceId),
    enabled,
  });
}

export function useHostStatsQuery(hostId: string | undefined) {
  return useQuery({
    queryKey: ["host-stats", hostId],
    queryFn: () => fetchHostStats(hostId as string),
    enabled: Boolean(hostId),
  });
}

export function useSpaceLikeStatusQuery(spaceId: number) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return useQuery({
    queryKey: ["space-like", spaceId],
    queryFn: () => fetchSpaceLikeStatus(spaceId),
    enabled: isAuthenticated,
  });
}

export function useToggleSpaceLikeMutation(spaceId: number, isLiked: boolean) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => (isLiked ? unlikeSpace(spaceId) : likeSpace(spaceId)),
    onSuccess: (data: LikeStatus) => {
      queryClient.setQueryData(["space-like", spaceId], data);
      queryClient.setQueryData<SpaceDetail | undefined>(["space", spaceId], (prev) =>
        prev ? { ...prev, like_count: data.like_count } : prev,
      );
      queryClient.invalidateQueries({ queryKey: ["spaces", "liked"] });
    },
  });
}

export function useCreateMatchingMutation() {
  return useMutation({
    mutationFn: (request: MatchingCreateRequest): Promise<MatchingCreateResponse> => createMatching(request),
  });
}

/**
 * Space reviews are tied to a *completed* matching, but `MatchingStatus` has
 * no "COMPLETED" value (only REQUESTED/APPROVED/REJECTED/CANCELED). Treat an
 * APPROVED matching whose `end_time` has passed as "completed" — the closest
 * approximation the current backend shape allows.
 */
export function useEligibleReviewMatchingQuery(spaceId: number) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return useQuery({
    queryKey: ["my-matchings-for-review", spaceId],
    queryFn: fetchMyMatchings,
    enabled: isAuthenticated,
    select: (matchings) =>
      matchings.find(
        (matching) =>
          matching.space_id === spaceId &&
          matching.status === "APPROVED" &&
          new Date(matching.end_time).getTime() < Date.now(),
      ) ?? null,
  });
}

export function useCreateSpaceReviewMutation(spaceId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ matchingId, rating, content }: { matchingId: number; rating: number; content: string }) =>
      createSpaceReview(matchingId, { rating, content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["space-reviews", spaceId] });
      queryClient.invalidateQueries({ queryKey: ["my-matchings-for-review", spaceId] });
    },
  });
}

export function computeReviewSummary(reviews: SpaceReview[]): { average: number; count: number } {
  if (reviews.length === 0) return { average: 0, count: 0 };
  const total = reviews.reduce((sum, review) => sum + review.rating, 0);
  return { average: total / reviews.length, count: reviews.length };
}

export type { HostStats };

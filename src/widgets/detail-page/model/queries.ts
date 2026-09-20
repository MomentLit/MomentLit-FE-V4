import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/entities/auth";
import { fetchSpace, fetchAvailability, fetchBookedDates } from "@/entities/space/api";
import type { DayOfWeek, SpaceAvailabilitySlot, SpaceDetail, UsageUnit } from "@/entities/space";
import { fetchSpaceReviews, createSpaceReview } from "@/entities/review";
import type { SpaceReview } from "@/entities/review";
import {
  createMatching,
  fetchHostStats,
  fetchMyMatchings,
} from "@/entities/matching";
import type { HostStats, MatchingCreateRequest, MatchingCreateResponse } from "@/entities/matching";
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

/** true when `date` has at least one open weekly slot and isn't already fully booked. */
export function isDateOpen(date: string, availability: SpaceAvailabilitySlot[], bookedDates: string[]): boolean {
  if (bookedDates.includes(date)) return false;
  const dayOfWeek = dayOfWeekForDate(date);
  return availability.some((slot) => slot.is_open && slot.day_of_week === dayOfWeek);
}

export function toDateInputValue(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Hours between an availability slot's `start_time`/`end_time` (`"HH:mm:ss"` strings). */
export function slotDurationHours(slot: SpaceAvailabilitySlot): number {
  const toMinutes = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
  };
  return Math.max(0, (toMinutes(slot.end_time) - toMinutes(slot.start_time)) / 60);
}

export function useSpaceQuery(spaceId: number) {
  return useQuery({
    queryKey: ["space", spaceId],
    queryFn: () => fetchSpace(spaceId),
    retry: 1,
  });
}

export function useAvailabilityQuery(spaceId: number, enabled: boolean) {
  return useQuery({
    queryKey: ["space-availability", spaceId],
    queryFn: () => fetchAvailability(spaceId),
    enabled,
  });
}

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

import { apiClient, publicApiClient } from "@/shared/api/client";
import type { ApiResponse, PageResponse } from "@/shared/api/types";
import type { SpaceCategory } from "@/entities/space-category";
import type { Region } from "@/entities/region";
import type {
  MySpaceListItem,
  SpaceAvailabilitySlot,
  SpaceCategoryCount,
  SpaceCreateRequest,
  SpaceCreateResponse,
  SpaceDetail,
  SpaceListItem,
  SpaceRegionCount,
  SpaceUpdateRequest,
  UsageUnit,
} from "./model";

export interface SpaceSearchParams {
  page?: number;
  size?: number;
  sort?: string;
  name?: string;
  category?: SpaceCategory;
  region?: Region;
  usageUnit?: UsageUnit;
  minCapacity?: number;
  maxCapacity?: number;
  /** ISO date (`YYYY-MM-DD`) — only spaces with an open weekly availability slot on that date's day-of-week match. Doesn't check that day's existing bookings. */
  date?: string;
  /** 둘 다 있을 때만 "가까운순" 정렬로 전환된다(백엔드가 sort 파라미터보다 우선함). */
  lat?: number;
  lng?: number;
}

/** Builds the query string the backend's `@PageableDefault`/filter params expect (camelCase keys — verified against SpaceController). */
function toSearchQuery(params: SpaceSearchParams): Record<string, string | number> {
  const query: Record<string, string | number> = {};
  if (params.page !== undefined) query.page = params.page;
  if (params.size !== undefined) query.size = params.size;
  if (params.sort) query.sort = params.sort;
  if (params.name) query.name = params.name;
  if (params.category) query.category = params.category;
  if (params.region) query.region = params.region;
  if (params.usageUnit) query["usage-unit"] = params.usageUnit;
  if (params.minCapacity !== undefined) query["min-capacity"] = params.minCapacity;
  if (params.maxCapacity !== undefined) query["max-capacity"] = params.maxCapacity;
  if (params.date) query.date = params.date;
  if (params.lat !== undefined) query.lat = params.lat;
  if (params.lng !== undefined) query.lng = params.lng;
  return query;
}

export async function searchSpaces(params: SpaceSearchParams = {}): Promise<PageResponse<SpaceListItem>> {
  const { data } = await publicApiClient.get<ApiResponse<PageResponse<SpaceListItem>>>("/spaces", {
    params: toSearchQuery(params),
  });
  return data.data;
}

export async function fetchMySpaces(params: SpaceSearchParams = {}): Promise<PageResponse<MySpaceListItem>> {
  const { data } = await apiClient.get<ApiResponse<PageResponse<MySpaceListItem>>>("/spaces/me", {
    params: toSearchQuery(params),
  });
  return data.data;
}

export async function fetchLikedSpaces(params: SpaceSearchParams = {}): Promise<PageResponse<SpaceListItem>> {
  const { data } = await apiClient.get<ApiResponse<PageResponse<SpaceListItem>>>("/spaces/me/liked", {
    params: toSearchQuery(params),
  });
  return data.data;
}

export async function fetchSpace(spaceId: number): Promise<SpaceDetail> {
  const { data } = await publicApiClient.get<ApiResponse<SpaceDetail>>(`/spaces/${spaceId}`);
  return data.data;
}

export async function createSpace(request: SpaceCreateRequest): Promise<SpaceCreateResponse> {
  const { data } = await apiClient.post<ApiResponse<SpaceCreateResponse>>("/spaces", request);
  return data.data;
}

export async function updateSpace(spaceId: number, request: SpaceUpdateRequest): Promise<void> {
  await apiClient.patch(`/spaces/${spaceId}`, request);
}

export async function fetchCategoryCounts(): Promise<SpaceCategoryCount[]> {
  const { data } = await publicApiClient.get<ApiResponse<SpaceCategoryCount[]>>("/spaces/counts/by-category");
  return data.data;
}

export async function fetchRegionCounts(): Promise<SpaceRegionCount[]> {
  const { data } = await publicApiClient.get<ApiResponse<SpaceRegionCount[]>>("/spaces/counts/by-region");
  return data.data;
}

export async function fetchAvailability(spaceId: number): Promise<SpaceAvailabilitySlot[]> {
  const { data } = await publicApiClient.get<ApiResponse<{ availabilities: SpaceAvailabilitySlot[] }>>(
    `/spaces/${spaceId}/availability`,
  );
  return data.data.availabilities;
}

/** ISO date strings (오늘 이후) that already have an approved booking — used to block them in the date picker. */
export async function fetchBookedDates(spaceId: number): Promise<string[]> {
  const { data } = await publicApiClient.get<ApiResponse<{ dates: string[] }>>(`/spaces/${spaceId}/booked-dates`);
  return data.data.dates;
}

/** Full-overwrite semantics — sends the whole week's slots, not a diff (matches the backend's delete-then-insert behavior). */
export async function updateAvailability(spaceId: number, slots: SpaceAvailabilitySlot[]): Promise<void> {
  await apiClient.put(`/spaces/${spaceId}/availability`, slots);
}

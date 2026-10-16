import type { SpaceCategory } from "@/entities/space-category";
import type { Region } from "@/entities/region";

/**
 * Mirrors the backend's `AddressResponse` exactly (verified via a real
 * `GET /spaces/{id}` call against the running backend, and cross-checked
 * against source) — every field is snake_case on the wire.
 */
export interface AddressResponse {
  sido: string;
  sigungu: string;
  eup_myeon_dong: string;
  road_address: string;
  jibun_address: string | null;
  detail_address: string | null;
  postal_code: string;
  /** Auto-derived server-side from `sido` (`Region.fromSido`) — null when unmatched. */
  region: Region | null;
}

/** What the host submits when registering/updating a space's address (also snake_case). */
export interface AddressRequest {
  sido: string;
  sigungu: string;
  eup_myeon_dong: string;
  road_address: string;
  jibun_address?: string;
  detail_address?: string;
  postal_code: string;
}

export type UsageUnit = "HOURLY" | "DAILY";

export type SpaceAdminStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";

/** Server/ChatBot-owned async summary state returned only from space detail. */
export type AiSummaryStatus = "PENDING" | "COMPLETED" | "FAILED" | "NOT_REQUESTED";

/** Shared fields across `SpaceListResponse`/`MySpaceListResponse`/`SpaceDetailResponse`. */
interface SpaceBase {
  space_id: number;
  name: string;
  address: AddressResponse;
  thumbnail_url: string | null;
  price_per_hour: number;
  like_count: number;
  category: SpaceCategory;
  area: number | null;
  capacity: number | null;
  floor: string | null;
  parking_info: string | null;
  usage_unit: UsageUnit | null;
}

/** `GET /spaces` list item. */
export type SpaceListItem = SpaceBase;

/** `GET /spaces/me` list item — same shape plus the host-only admin fields. */
export interface MySpaceListItem extends SpaceBase {
  admin_status: SpaceAdminStatus;
  is_active: boolean;
}

/** INTERNAL: 모먼트릿에서 예약 요청을 받음, EXTERNAL: 호스트의 외부 홈페이지에서 예약. */
export type BookingType = "INTERNAL" | "EXTERNAL";

/** `GET /spaces/{id}`. */
export interface SpaceDetail extends SpaceBase {
  host_id: string;
  host_name: string;
  host_image_url: string | null;
  description: string;
  /** Generated asynchronously by the server; never include this in create/update requests. */
  ai_summary: string | null;
  ai_summary_status: AiSummaryStatus;
  image_urls: string[];
  /** 360도(등장방형 2:1) 사진 — 없으면 null. */
  panorama_url: string | null;
  admin_status: SpaceAdminStatus;
  /** 백엔드 배포 전 응답에는 없을 수 있다 — 없으면 INTERNAL로 본다. */
  booking_type?: BookingType;
  external_booking_url?: string | null;
}

export interface SpaceCreateRequest {
  name: string;
  description: string;
  address: AddressRequest;
  thumbnail_url?: string;
  image_urls?: string[];
  /** 수정 시 빈 문자열(`""`)을 보내면 360도 사진을 삭제한다. 생략하면 변경 없음. */
  panorama_url?: string;
  price_per_hour: number;
  category: SpaceCategory;
  phone?: string;
  area?: number;
  capacity?: number;
  floor?: string;
  parking_info?: string;
  usage_unit?: UsageUnit;
  is_draft?: boolean;
  booking_type?: BookingType;
  /** EXTERNAL일 때 필수 (http/https). 수정 시 빈 문자열이면 링크 삭제. */
  external_booking_url?: string;
}

export type SpaceUpdateRequest = Partial<SpaceCreateRequest>;

export interface SpaceCreateResponse {
  space_id: number;
}

export type DayOfWeek =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

export interface SpaceAvailabilitySlot {
  day_of_week: DayOfWeek;
  start_time: string;
  end_time: string;
  is_open: boolean;
}

export interface SpaceCategoryCount {
  category: SpaceCategory;
  count: number;
}

export interface SpaceRegionCount {
  region: string;
  count: number;
}

/** 공간 하나에 올릴 수 있는 사진 수 (대표 사진 포함). */
export const MAX_SPACE_PHOTOS = 10;

/** 대표 사진 + 추가 사진을 중복 없이 순서대로 — 대표 사진이 항상 첫 번째. */
export function getSpacePhotoUrls(space: Pick<SpaceDetail, "thumbnail_url" | "image_urls">): string[] {
  const urls = [space.thumbnail_url, ...(space.image_urls ?? [])].filter((url): url is string => Boolean(url));
  return Array.from(new Set(urls));
}

/** 외부 예약 링크가 http(s) 주소인지 — 백엔드 `Space.updateBooking`과 같은 기준. */
export function isValidExternalBookingUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    return (parsed.protocol === "http:" || parsed.protocol === "https:") && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

/** 외부 예약 공간이면 이동할 링크를, 아니면 null을 돌려준다. */
export function getExternalBookingUrl(space: Pick<SpaceDetail, "booking_type" | "external_booking_url">): string | null {
  return space.booking_type === "EXTERNAL" && space.external_booking_url ? space.external_booking_url : null;
}

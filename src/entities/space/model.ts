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

/** `GET /spaces/{id}`. */
export interface SpaceDetail extends SpaceBase {
  host_id: string;
  host_name: string;
  host_image_url: string | null;
  description: string;
  ai_summary: string | null;
  image_urls: string[];
  admin_status: SpaceAdminStatus;
}

export interface SpaceCreateRequest {
  name: string;
  description: string;
  address: AddressRequest;
  thumbnail_url?: string;
  image_urls?: string[];
  price_per_hour: number;
  category: SpaceCategory;
  phone?: string;
  area?: number;
  capacity?: number;
  floor?: string;
  parking_info?: string;
  usage_unit?: UsageUnit;
  is_draft?: boolean;
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

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

/** 장면에서 다른 장면으로 가는 이동 화살표 — `yaw`는 출발 장면의 수평 방향(라디안, 0 이상 2π 미만). */
export interface PanoramaSceneLink {
  target_scene_id: number;
  yaw: number;
}

/** 공간 안 360도 장면 한 장 — `sort_order` 0번이 시작 장면이고, `links`의 화살표로 다른 장면에 이동한다. */
export interface PanoramaScene {
  scene_id: number;
  image_url: string;
  name: string | null;
  sort_order: number;
  links: PanoramaSceneLink[];
}

/** 등록/수정 요청의 이동 화살표 — 도착 장면은 같은 요청 `panorama_scenes` 안의 위치로 가리킨다. */
export interface PanoramaSceneLinkRequest {
  target_index: number;
  yaw: number;
}

/** 등록/수정 요청의 360도 장면 — 목록의 첫 장면이 시작 장면이 된다. */
export interface PanoramaSceneRequest {
  image_url: string;
  name?: string;
  links?: PanoramaSceneLinkRequest[];
}

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
  /** 360도(등장방형 2:1) 사진 — 없으면 null. 하위 호환용으로 남겨 둔 값이라 장면이 있으면 첫 장면과 같다. */
  panorama_url: string | null;
  /** 360도 장면 목록. 장면 기능 이전에 저장된 공간은 비어 있을 수 있다(그때는 `panorama_url` 한 장). */
  panorama_scenes: PanoramaScene[];
  admin_status: SpaceAdminStatus;
}

export interface SpaceCreateRequest {
  name: string;
  description: string;
  address: AddressRequest;
  thumbnail_url?: string;
  image_urls?: string[];
  /** 수정 시 빈 문자열(`""`)을 보내면 360도 사진을 삭제한다. 생략하면 변경 없음. */
  panorama_url?: string;
  /** 생략하면 변경 없음, 빈 배열이면 360도 장면 전체 삭제. 보내면 서버가 `panorama_url`을 첫 장면으로 맞춘다. */
  panorama_scenes?: PanoramaSceneRequest[];
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

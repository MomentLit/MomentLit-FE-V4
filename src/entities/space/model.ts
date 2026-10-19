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
  /** 최소 이용 인원 — 백엔드 배포 전 응답에는 없을 수 있다. */
  min_capacity?: number | null;
  floor: string | null;
  /** 더 이상 입력받지 않는다(이용 안내로 대체). 기존 데이터 보존용. */
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
  /** 문의·주의·이용사항 (공간 공통). */
  usage_notice?: string | null;
  /** 호스트가 선택으로 입력한 연락처 — 입력하면 공개된다. */
  phone?: string | null;
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
  /** 선택. 입력하면 상세에 공개. 수정 시 빈 문자열이면 삭제. */
  phone?: string;
  area?: number;
  capacity?: number;
  /** 수정 시 0이면 삭제. */
  min_capacity?: number;
  /** 수정 시 빈 문자열이면 삭제. */
  usage_notice?: string;
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

/**
 * 공간 상세 맨 위 사진 영역의 비율(가로/세로) — PC 기준. 사진 위치 조절 틀도 같은 값을 쓴다.
 * 모바일은 아직 따로 맞추지 않고 같은 영역을 가운데 기준으로 보여준다.
 */
export const SPACE_HERO_ASPECT = 2;

/** 공간 하나에 올릴 수 있는 사진 수 (대표 사진 포함). */
export const MAX_SPACE_PHOTOS = 30;

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

/**
 * 한 공간 안의 구역(1층, 2층 세미나실…)은 백엔드에 따로 저장할 곳이 없어서 구역마다
 * Space를 하나씩 만들고 이름을 `공간 이름 · 구역 이름`으로 맞춘다. 상세 페이지는
 * 이름의 앞부분과 도로명 주소가 같은 공간들을 같은 공간의 구역으로 묶어 보여준다.
 */
export const SPACE_OPTION_SEPARATOR = " · ";

export function joinSpaceOptionName(baseName: string, optionLabel: string): string {
  return `${baseName}${SPACE_OPTION_SEPARATOR}${optionLabel}`;
}

/** 마지막 구분자 기준으로 나눈다 — 구분자가 없으면 구역이 없는 일반 공간(`optionLabel: null`). */
export function splitSpaceOptionName(name: string): { baseName: string; optionLabel: string | null } {
  const index = name.lastIndexOf(SPACE_OPTION_SEPARATOR);
  if (index <= 0) return { baseName: name, optionLabel: null };
  const optionLabel = name.slice(index + SPACE_OPTION_SEPARATOR.length).trim();
  return optionLabel ? { baseName: name.slice(0, index).trim(), optionLabel } : { baseName: name, optionLabel: null };
}

/** 목록 카드 하나로 합쳐진 구역 묶음 정보 — 구역이 없는 공간은 `null`. */
export interface SpaceOptionGroup {
  /** 구역 수 (2 이상). */
  count: number;
  /** 가장 싼 구역의 요금 — 카드에 "~부터"로 보여준다. 그 구역의 이용 단위는 `usage_unit`. */
  minPrice: number;
}

export type GroupedSpace<T> = T & { option_group: SpaceOptionGroup | null };

/**
 * 목록(검색·홈·지도)에서 같은 공간의 구역들을 대표 카드 하나로 합친다 — 이름 앞부분과
 * 도로명 주소가 같은 공간끼리 묶고(`splitSpaceOptionName`), 카드는 가장 먼저 나온
 * 구역 자리(서버 정렬 순서 유지)에 둔다. 대표 카드는 공통 이름, 최저 요금, 가장 큰
 * 수용 인원, 첫 구역의 사진을 쓰고, 누르면 첫 구역 상세(구역 탭)로 간다.
 * 전달받은 목록 안에서 합치므로 전체 개수와 페이지를 계산할 때는 모든 페이지를 먼저 모아야 한다.
 */
export function groupSpaceOptions<T extends SpaceListItem>(items: T[]): GroupedSpace<T>[] {
  const groups = new Map<string, T[]>();
  const order: Array<string | T> = [];
  for (const item of items) {
    const { baseName, optionLabel } = splitSpaceOptionName(item.name);
    if (!optionLabel) {
      order.push(item);
      continue;
    }
    const key = `${baseName}\u0000${item.address.road_address}`;
    const group = groups.get(key);
    if (group) group.push(item);
    else {
      groups.set(key, [item]);
      order.push(key);
    }
  }
  return order.map((entry) => {
    if (typeof entry !== "string") return { ...entry, option_group: null };
    const members = groups.get(entry) ?? [];
    if (members.length < 2) return { ...members[0], option_group: null };
    const byId = [...members].sort((a, b) => a.space_id - b.space_id);
    const cheapest = members.reduce((min, item) => (item.price_per_hour < min.price_per_hour ? item : min));
    const capacities = members.map((item) => item.capacity).filter((value): value is number => value != null);
    return {
      ...byId[0],
      name: splitSpaceOptionName(byId[0].name).baseName,
      thumbnail_url: byId.find((item) => item.thumbnail_url)?.thumbnail_url ?? null,
      price_per_hour: cheapest.price_per_hour,
      usage_unit: cheapest.usage_unit,
      capacity: capacities.length > 0 ? Math.max(...capacities) : null,
      like_count: members.reduce((sum, item) => sum + item.like_count, 0),
      option_group: { count: members.length, minPrice: cheapest.price_per_hour },
    };
  });
}

/** Count cards using the same grouping as each destination's filtered search. */
export function countSpaceOptions(items: SpaceListItem[]): {
  total: number;
  byCategory: SpaceCategoryCount[];
  byRegion: SpaceRegionCount[];
} {
  const categories = new Map<SpaceCategory, SpaceListItem[]>();
  const regions = new Map<string, SpaceListItem[]>();
  for (const item of items) {
    const categoryItems = categories.get(item.category) ?? [];
    categoryItems.push(item);
    categories.set(item.category, categoryItems);
    const region = item.address.region ?? "UNKNOWN";
    const regionItems = regions.get(region) ?? [];
    regionItems.push(item);
    regions.set(region, regionItems);
  }
  return {
    total: groupSpaceOptions(items).length,
    byCategory: Array.from(categories, ([category, members]) => ({ category, count: groupSpaceOptions(members).length })),
    byRegion: Array.from(regions, ([region, members]) => ({ region, count: groupSpaceOptions(members).length })),
  };
}

/** 인원 표시 — "2~10인", "최대 10인", "최소 2인". 둘 다 없으면 null. */
export function formatCapacityRange(minCapacity: number | null | undefined, capacity: number | null | undefined): string | null {
  if (minCapacity != null && capacity != null) {
    return minCapacity === capacity ? `${capacity}인` : `${minCapacity}~${capacity}인`;
  }
  if (capacity != null) return `최대 ${capacity}인`;
  if (minCapacity != null) return `최소 ${minCapacity}인`;
  return null;
}

/** 공간 연락처 형식 — 백엔드 `SpaceCreateRequest.phone`과 같은 기준(숫자, +, -, 괄호, 공백 7~20자). */
export function isValidSpacePhone(phone: string): boolean {
  return /^[0-9+()\-\s]{7,20}$/.test(phone.trim());
}

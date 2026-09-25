/** Slider bounds for the "수용 인원" filter — `CAPACITY_MAX` doubles as the "no limit" sentinel. */
export const CAPACITY_MIN = 2;
export const CAPACITY_MAX = 60;

export const PAGE_SIZE = 12;

/**
 * `GET /popups` only takes `page`/`size` — there's no server-side keyword
 * filter for it like `SpaceSearchParams.name`. So a popup keyword search
 * fetches one larger batch and filters client-side instead of paging
 * through the backend; this is how many items that one batch covers.
 */
export const POPUP_SEARCH_FETCH_SIZE = 60;

/**
 * `SpaceController` supports `createdAt`(기본)/`likeCount` via the normal
 * `sort` param, plus a `distance` pseudo-sort handled separately by passing
 * `lat`/`lng` (브라우저 Geolocation) — 공간 좌표는 권역 단위 근사치라 서울 안에서처럼
 * 좁은 범위의 순서까지 정확하진 않다.
 */
export type SortKey = "latest" | "popular" | "distance";

export type SearchMode = "space" | "popup";

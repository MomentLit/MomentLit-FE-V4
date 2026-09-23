import type { SpectrumTone } from "@/shared/ui";

/**
 * Frontend-only region grouping — the backend has no region model yet
 * (Address is free-text `sido`/`sigungu`/... with no enum or master table,
 * see ANALYSIS.md §3.2/§5 item 4). These 8 values are the region groupings
 * design-reference.html uses; once the backend adds a `region` column this
 * type should mirror its values so `Address.sido` can be mapped 1:1.
 */
export type Region =
  | "SEOUL"
  | "GYEONGGI_INCHEON"
  | "BUSAN_GYEONGNAM"
  | "DAEGU_GYEONGBUK"
  | "DAEJEON_CHUNGCHEONG"
  | "GWANGJU_JEOLLA"
  | "GANGWON"
  | "JEJU";

export const REGION_LABELS: Record<Region, string> = {
  SEOUL: "서울",
  GYEONGGI_INCHEON: "경기 · 인천",
  BUSAN_GYEONGNAM: "부산 · 경남",
  DAEGU_GYEONGBUK: "대구 · 경북",
  DAEJEON_CHUNGCHEONG: "대전 · 충청",
  GWANGJU_JEOLLA: "광주 · 전라",
  GANGWON: "강원",
  JEJU: "제주",
};

export const REGIONS = Object.keys(REGION_LABELS) as Region[];

/**
 * 8 regions onto the 6-color spectrum, so two reuses are unavoidable: JEJU
 * and DAEJEON_CHUNGCHEONG both get `violet` (in the region grid's 4-column
 * layout they land in the same row at opposite ends, so the repeat isn't
 * adjacent), and GYEONGGI_INCHEON gets `lemon` (already used by DAEGU_GYEONGBUK
 * two tiles away in the same row — not touching either).
 */
export const REGION_COLORS: Record<Region, SpectrumTone> = {
  SEOUL: "sky",
  GYEONGGI_INCHEON: "lemon",
  BUSAN_GYEONGNAM: "lime",
  DAEGU_GYEONGBUK: "lemon",
  DAEJEON_CHUNGCHEONG: "violet",
  GWANGJU_JEOLLA: "coral",
  GANGWON: "rose",
  JEJU: "violet",
};

import type { Region } from "@/entities/region";
import type { SpectrumTone } from "@/shared/ui";

/**
 * Best-effort sido → Region match for popups. Unlike spaces (`SpaceSearchParams.region`
 * goes straight to the backend), `GET /popups` has no region filter — see
 * SearchPageContent's POPUP_SEARCH_FETCH_SIZE comment for why. `Address.sido` comes
 * back in full administrative form ("서울특별시", "충청남도", ...), so this matches by
 * substring against the short form instead of an exact map.
 */
const REGION_SIDO_KEYWORDS: Record<Region, string[]> = {
  SEOUL: ["서울"],
  GYEONGGI_INCHEON: ["경기", "인천"],
  BUSAN_GYEONGNAM: ["부산", "울산", "경남", "경상남"],
  DAEGU_GYEONGBUK: ["대구", "경북", "경상북"],
  DAEJEON_CHUNGCHEONG: ["대전", "세종", "충남", "충북", "충청"],
  GWANGJU_JEOLLA: ["광주", "전남", "전북", "전라"],
  GANGWON: ["강원"],
  JEJU: ["제주"],
};

export function matchesRegion(sido: string, region: Region): boolean {
  return REGION_SIDO_KEYWORDS[region].some((keyword) => sido.includes(keyword));
}

/** True when `dateIso` (`YYYY-MM-DD`) falls within the popup's [start_time, end_time] run. */
export function isPopupOpenOnDate(popup: { start_time: string; end_time: string }, dateIso: string): boolean {
  return dateIso >= popup.start_time.slice(0, 10) && dateIso <= popup.end_time.slice(0, 10);
}

/**
 * Popups have no category field at all on the backend (unlike spaces'
 * `SpaceCategory`) — this is a made-up taxonomy for popup-store brand
 * verticals, not a real one. `guessPopupCategory` classifies by keyword
 * match against the title, so it's a heuristic and will misclassify titles
 * that don't spell out their vertical.
 */
export type PopupCategory = "BEAUTY" | "HEALTH" | "FASHION" | "FOOD" | "LIVING" | "TECH" | "CULTURE" | "OTHER";

export const POPUP_CATEGORY_LABELS: Record<PopupCategory, string> = {
  BEAUTY: "뷰티",
  HEALTH: "헬스",
  FASHION: "패션",
  FOOD: "푸드",
  LIVING: "리빙",
  TECH: "테크",
  CULTURE: "컬처",
  OTHER: "기타",
};

export const POPUP_CATEGORIES = Object.keys(POPUP_CATEGORY_LABELS) as PopupCategory[];

export const POPUP_CATEGORY_TONES: Record<PopupCategory, SpectrumTone> = {
  BEAUTY: "rose",
  HEALTH: "lime",
  FASHION: "violet",
  FOOD: "lemon",
  LIVING: "coral",
  TECH: "sky",
  CULTURE: "violet",
  OTHER: "sky",
};

const CATEGORY_KEYWORDS: Record<Exclude<PopupCategory, "OTHER">, string[]> = {
  BEAUTY: ["뷰티", "화장품", "코스메틱", "스킨케어", "향수", "네일"],
  HEALTH: ["헬스", "피트니스", "요가", "필라테스", "웰니스", "운동"],
  FASHION: ["패션", "의류", "슈즈", "가방", "스타일"],
  FOOD: ["푸드", "맛집", "카페", "베이커리", "디저트", "커피", "레스토랑", "다이닝"],
  LIVING: ["리빙", "인테리어", "가구", "소품", "라이프스타일"],
  TECH: ["테크", "가전", "디지털", "전자"],
  CULTURE: ["컬처", "아트", "전시", "공연", "굿즈", "캐릭터"],
};

export function guessPopupCategory(title: string): PopupCategory {
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS) as [
    Exclude<PopupCategory, "OTHER">,
    string[],
  ][]) {
    if (keywords.some((keyword) => title.includes(keyword))) return category;
  }
  return "OTHER";
}

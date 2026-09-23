import type { SpectrumTone } from "@/shared/ui";

/** Matches the backend `SpaceCategory` enum exactly (see ANALYSIS.md §3.2). */
export type SpaceCategory =
  | "PRACTICE_ROOM"
  | "STUDIO"
  | "MEETING_ROOM"
  | "PARTY_ROOM"
  | "CLASSROOM"
  | "POPUP_STORE"
  | "OFFICE"
  | "HALL"
  | "CAFE"
  | "OTHER";

export const SPACE_CATEGORY_LABELS: Record<SpaceCategory, string> = {
  PRACTICE_ROOM: "연습실",
  STUDIO: "스튜디오",
  MEETING_ROOM: "회의실",
  PARTY_ROOM: "파티룸",
  CLASSROOM: "강의실",
  POPUP_STORE: "팝업스토어",
  OFFICE: "오피스",
  HALL: "홀",
  CAFE: "카페",
  OTHER: "기타",
};

export const SPACE_CATEGORIES = Object.keys(
  SPACE_CATEGORY_LABELS,
) as SpaceCategory[];

/**
 * 10 categories mapped onto the 6-color spectrum, so colors are necessarily
 * reused: STUDIO, CLASSROOM and PRACTICE_ROOM all get `rose`, POPUP_STORE
 * and OTHER both get `sky`, and OFFICE reuses HALL's `lemon`. None of these
 * repeats land on tiles that actually touch (edge or corner) in the
 * mosaic's 6-column grid — see CategoryMosaic for the layout this was
 * checked against. The landing mosaic overrides OTHER to a plain white tile
 * regardless of this mapping.
 */
export const SPACE_CATEGORY_COLORS: Record<SpaceCategory, SpectrumTone> = {
  POPUP_STORE: "sky",
  STUDIO: "rose",
  CAFE: "lime",
  HALL: "lemon",
  OFFICE: "lemon",
  MEETING_ROOM: "coral",
  PRACTICE_ROOM: "rose",
  PARTY_ROOM: "violet",
  CLASSROOM: "rose",
  OTHER: "sky",
};

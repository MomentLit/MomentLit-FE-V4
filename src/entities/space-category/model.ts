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
 * 10 categories mapped onto the 8-color spectrum. With 10 categories and
 * only 8 colors, two colors are necessarily reused (see ANALYSIS.md §2.7):
 * design-reference.html's category mosaic maps STUDIO and CLASSROOM to the
 * same `mint`; POPUP_STORE and OTHER are the second pair we reuse `sky` for
 * (OTHER doesn't appear in the reference mosaic, so it isn't pinned to a
 * specific color there — `sky` was chosen as the neutral/default spectrum
 * color for the catch-all category).
 */
export const SPACE_CATEGORY_COLORS: Record<SpaceCategory, SpectrumTone> = {
  POPUP_STORE: "sky",
  STUDIO: "mint",
  CAFE: "lime",
  HALL: "lemon",
  OFFICE: "apricot",
  MEETING_ROOM: "coral",
  PRACTICE_ROOM: "rose",
  PARTY_ROOM: "violet",
  CLASSROOM: "mint",
  OTHER: "sky",
};

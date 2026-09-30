import type { SpaceCategory } from "@/entities/space-category";

// Landing tiles and main navigation consume the same presentation order.
export { SPACE_CATEGORY_DISPLAY_ORDER as CATEGORY_DISPLAY_ORDER } from "@/entities/space-category";

/** Grid span (in cells) per category tile in the "어떤 공간이든" mosaic — see design-reference.html `.mos a` inline `--w`/`--h` values. */
export const CATEGORY_MOSAIC_SPAN: Record<SpaceCategory, { w?: 2; h?: 2 }> = {
  POPUP_STORE: { w: 2, h: 2 },
  STUDIO: { w: 2 },
  CAFE: {},
  HALL: {},
  OFFICE: { w: 2 },
  MEETING_ROOM: {},
  PRACTICE_ROOM: {},
  PARTY_ROOM: { w: 2 },
  CLASSROOM: { w: 2 },
  OTHER: { w: 2 },
};

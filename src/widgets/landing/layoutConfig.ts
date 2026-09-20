import type { SpaceCategory } from "@/entities/space-category";

/**
 * Category display order for the landing page (mosaic tiles + hero combo
 * select) — ports the `01`–`10` sequence from design-reference.html's `.mos`
 * markup. NOTE: this intentionally does NOT match `SPACE_CATEGORIES`'
 * iteration order (that's just `Object.keys()` on the entity's label map,
 * declared in a different order) — this array is the presentation order.
 */
export const CATEGORY_DISPLAY_ORDER: SpaceCategory[] = [
  "POPUP_STORE",
  "STUDIO",
  "CAFE",
  "HALL",
  "OFFICE",
  "MEETING_ROOM",
  "PRACTICE_ROOM",
  "PARTY_ROOM",
  "CLASSROOM",
  "OTHER",
];

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

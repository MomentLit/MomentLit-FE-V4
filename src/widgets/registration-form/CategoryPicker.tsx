import {
  SPACE_CATEGORIES,
  SPACE_CATEGORY_COLORS,
  SPACE_CATEGORY_LABELS,
  type SpaceCategory,
} from "@/entities/space-category";
import type { SpectrumTone } from "@/shared/ui";
import { cn } from "@/shared/lib";

export interface CategoryPickerProps {
  value: SpaceCategory;
  onChange: (category: SpaceCategory) => void;
}

// Written out as literal class names (not built from a template string) so
// Tailwind's static scanner can see and generate them — same reasoning as
// shared/ui/Card.tsx's TONE_CLASSES.
const TONE_BG_CLASSES: Record<SpectrumTone, string> = {
  sky: "bg-sky",
  mint: "bg-mint",
  lime: "bg-lime",
  lemon: "bg-lemon",
  apricot: "bg-apricot",
  coral: "bg-coral",
  rose: "bg-rose",
  violet: "bg-violet",
};

/**
 * Port of design-reference.html's `.catpick` — a grid of color-pill radio
 * buttons, one per category, tinted with that category's spectrum color
 * when selected (`--dd` in the reference; here `SPACE_CATEGORY_COLORS`).
 */
export function CategoryPicker({ value, onChange }: CategoryPickerProps) {
  return (
    <div
      role="radiogroup"
      aria-label="카테고리"
      className="grid grid-cols-2 gap-0.5 bg-line sm:grid-cols-3 md:grid-cols-5"
    >
      {SPACE_CATEGORIES.map((category) => {
        const checked = value === category;
        const tone = SPACE_CATEGORY_COLORS[category];
        return (
          <label key={category} className="relative block cursor-pointer">
            <input
              type="radio"
              name="category"
              value={category}
              checked={checked}
              onChange={() => onChange(category)}
              className="absolute h-0 w-0 opacity-0"
            />
            <span
              className={cn(
                "flex min-h-[66px] items-end p-2.5 text-[0.85rem] font-bold text-ink transition-colors",
                checked ? TONE_BG_CLASSES[tone] : "bg-white hover:bg-wash",
              )}
            >
              {SPACE_CATEGORY_LABELS[category]}
            </span>
          </label>
        );
      })}
    </div>
  );
}

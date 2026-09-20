"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/shared/lib";
import {
  SPACE_CATEGORIES,
  SPACE_CATEGORY_COLORS,
  SPACE_CATEGORY_LABELS,
  type SpaceCategory,
} from "@/entities/space-category";
import { fetchCategoryCounts } from "@/entities/space/api";
import { TONE_ON_BG } from "./tone-dot";

/**
 * Category filter pill row — "전체" + all 10 categories, each with a real
 * count from `GET /spaces/counts/by-category` (missing/0-count categories
 * still render with "0"). Single-select toggle: clicking a pill selects it
 * exclusively; clicking the active pill again (or "전체") clears the
 * selection. Purely local UI state — no filtering wired to it yet, same as
 * before (the search page is where real filtering lives).
 */
export function CategoryFilterPills() {
  const [selected, setSelected] = useState<SpaceCategory | null>(null);

  const { data } = useQuery({
    queryKey: ["spaces", "counts", "by-category"],
    queryFn: fetchCategoryCounts,
  });

  const counts = new Map((data ?? []).map((entry) => [entry.category, entry.count]));
  const total = [...counts.values()].reduce((sum, n) => sum + n, 0);

  return (
    <nav aria-label="카테고리 필터" className="flex items-stretch gap-0 overflow-x-auto border-b border-line px-7">
      <button
        type="button"
        onClick={() => setSelected(null)}
        aria-pressed={selected === null}
        className={cn(
          "flex-none border-b-4 px-4 py-3.5 text-sm font-bold transition-colors",
          selected === null
            ? "border-ink bg-primary-100 text-ink"
            : "border-transparent text-soft hover:text-ink",
        )}
      >
        전체
        <span className="ml-1.5 text-xs font-normal opacity-65">{total}</span>
      </button>
      {SPACE_CATEGORIES.map((category) => {
        const isActive = selected === category;
        const tone = SPACE_CATEGORY_COLORS[category];
        return (
          <button
            key={category}
            type="button"
            onClick={() => setSelected((current) => (current === category ? null : category))}
            aria-pressed={isActive}
            className={cn(
              "flex-none border-b-4 px-4 py-3.5 text-sm font-bold transition-colors",
              isActive ? cn("border-ink", TONE_ON_BG[tone]) : "border-transparent text-soft hover:text-ink",
            )}
          >
            {SPACE_CATEGORY_LABELS[category]}
            <span className="ml-1.5 text-xs font-normal opacity-65">{counts.get(category) ?? 0}</span>
          </button>
        );
      })}
    </nav>
  );
}

"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { cn } from "@/shared/lib";
import {
  SPACE_CATEGORY_DISPLAY_ORDER,
  SPACE_CATEGORY_COLORS,
  SPACE_CATEGORY_LABELS,
} from "@/entities/space-category";
import { useSpaceDisplayCounts } from "@/entities/space/queries";
import styles from "./DashboardSearch.module.css";

/** Compact category navigation; each link opens matching search results. */
export function CategoryFilterPills() {
  const { data, isPending, isError } = useSpaceDisplayCounts();
  const counts = new Map((data?.byCategory ?? []).map((entry) => [entry.category, entry.count]));
  const displayCount = (count: number) => isPending ? "…" : isError ? "—" : count.toLocaleString();

  return (
    <nav aria-label="공간 카테고리" className="flex items-stretch gap-0 overflow-x-auto border-b border-line app-gutter">
      <Link href="/search" className={cn(styles.categoryLink, "flex-none px-4 py-3.5 text-sm font-bold text-ink")}>
        전체 <span className="ml-1.5 text-xs font-normal opacity-65">{displayCount(data?.total ?? 0)}</span>
      </Link>
      {SPACE_CATEGORY_DISPLAY_ORDER.map((category) => (
        <Link
          key={category}
          href={`/search?category=${category}`}
          className={cn(styles.categoryLink, "flex-none px-4 py-3.5 text-sm font-bold text-ink")}
          style={{ "--category-accent": `var(--${SPACE_CATEGORY_COLORS[category]})` } as CSSProperties}
        >
          {SPACE_CATEGORY_LABELS[category]}
          <span className="ml-1.5 text-xs font-normal opacity-65">{displayCount(counts.get(category) ?? 0)}</span>
        </Link>
      ))}
    </nav>
  );
}

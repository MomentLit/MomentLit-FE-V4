"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/shared/lib";
import { searchSpaces } from "@/entities/space/api";
import { SPACE_CATEGORY_COLORS, SPACE_CATEGORY_LABELS } from "@/entities/space-category";
import { getErrorMessage } from "@/shared/api/error";
import { formatAddress, formatCapacityText } from "../lib/format";
import { TONE_ON_BG } from "./tone-dot";

const PAGE_SIZE = 4;

/** "최근에 등록된 공간" — real `GET /spaces` (createdAt desc), 4 most recent. */
export function RecentSpaceCards() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["spaces", "recent", PAGE_SIZE],
    queryFn: () => searchSpaces({ page: 0, size: PAGE_SIZE }),
  });

  const spaces = data?.content ?? [];

  return (
    <section className="border-b border-line app-gutter py-8 sm:py-10">
      <div className="mb-3.5 flex items-center justify-between gap-3.5">
        <h2 className="section-title text-ink">최근에 등록된 공간</h2>
        <Link
          href="/search"
          className="shrink-0 whitespace-nowrap text-sm font-semibold text-ink/75 transition-colors hover:text-ink hover:underline underline-offset-4 sm:text-base"
        >
          전체 보기
        </Link>
      </div>

      {isLoading ? (
        <div className="collection-grid">
          {Array.from({ length: PAGE_SIZE }).map((_, i) => (
            <div key={i} className="aspect-3/2 animate-pulse rounded-xl border border-line bg-wash" />
          ))}
        </div>
      ) : isError ? (
        <p className="py-6 text-sm text-soft">공간을 불러오지 못했어요. {getErrorMessage(error)}</p>
      ) : spaces.length === 0 ? (
        <p className="py-6 text-sm text-soft">아직 등록된 공간이 없어요.</p>
      ) : (
        <div className="collection-grid">
          {spaces.map((space) => (
            <Link
              key={space.space_id}
              href={`/spaces/${space.space_id}`}
              className="group flex flex-col overflow-hidden rounded-xl border border-line bg-white interactive-card"
            >
              <div
                className={cn(
                  "relative flex aspect-3/2 flex-col justify-between overflow-hidden p-3.5",
                  !space.thumbnail_url && TONE_ON_BG[SPACE_CATEGORY_COLORS[space.category]],
                )}
              >
                {space.thumbnail_url && (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element -- 외부 S3 URL */}
                    <img
                      src={space.thumbnail_url}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-black/30" />
                  </>
                )}
                <span
                  className={cn(
                    "relative text-[0.61rem] font-medium uppercase tracking-[0.13em]",
                    space.thumbnail_url ? "text-white/85" : "opacity-70",
                  )}
                >
                  {SPACE_CATEGORY_LABELS[space.category]}
                </span>
                <span
                  className={cn(
                    "relative line-clamp-3 text-lg font-bold leading-tight tracking-tight",
                    space.thumbnail_url && "text-white",
                  )}
                >
                  {space.name}
                </span>
              </div>
              <div className="flex flex-col gap-0.5 px-3 py-2.5 shadow-[inset_0_1px_0_var(--line)]">
                <span className="line-clamp-1 text-sm font-bold tracking-tight text-ink">{space.name}</span>
                <span className="text-[0.79rem] text-soft">{formatAddress(space.address)}</span>
                <span className="mt-0.5 font-mono text-[0.67rem] text-soft">
                  {formatCapacityText(space.usage_unit, space.capacity)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

import Link from "next/link";
import { IconHeartFilled } from "@tabler/icons-react";
import { cn } from "@/shared/lib";
import type { PopupListItem } from "@/entities/popup";
import { toneForIndex, formatDateRangeShort, popupBadge } from "@/widgets/app-dashboard/lib/format";
import { formatAddress } from "../lib/format";
import { TONE_ON_BG } from "./tone-dot";

interface PopupResultListProps {
  items: PopupListItem[];
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  emptyMessage?: string;
}

const SKELETON_COUNT = 6;

/** 카드 그리드는 ResultList와 같은 레이아웃 — 팝업은 카테고리가 없어 톤은 인덱스로 순환시킨다. */
const GRID_CLASS = "grid grid-cols-1 gap-3 px-6 py-5 sm:grid-cols-2 2xl:grid-cols-3";

export function PopupResultList({
  items,
  isLoading,
  isError,
  errorMessage,
  emptyMessage = "조건에 맞는 팝업이 없어요.",
}: PopupResultListProps) {
  if (isLoading) {
    return (
      <div className={GRID_CLASS}>
        {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
          <div key={i} className="aspect-3/2 animate-pulse rounded-xl border border-line bg-wash" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <p className="text-sm text-soft">검색 결과를 불러오지 못했어요. {errorMessage}</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <p className="text-sm text-soft">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={GRID_CLASS}>
      {items.map((popup, i) => (
        <Link
          key={popup.popup_id}
          href={`/popups/${popup.popup_id}`}
          className="group flex flex-col overflow-hidden rounded-xl border border-line bg-white transition-all duration-300 hover:-translate-y-1.5 hover:border-ink"
        >
          <div
            className={cn(
              "relative flex aspect-3/2 flex-col justify-between overflow-hidden p-3.5",
              !popup.thumbnail_url && TONE_ON_BG[toneForIndex(popup.popup_id + i)],
            )}
          >
            {popup.thumbnail_url && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element -- 외부 S3 URL */}
                <img
                  src={popup.thumbnail_url}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-black/30" />
              </>
            )}
            <div className="relative flex items-start justify-between gap-2">
              <span
                className={cn(
                  "text-[0.61rem] font-medium uppercase tracking-[0.13em]",
                  popup.thumbnail_url ? "text-white/85" : "opacity-70",
                )}
              >
                Popup store
              </span>
              <span className="whitespace-nowrap bg-ink px-2 py-0.5 text-[0.63rem] font-medium text-white">
                {popupBadge(popup.start_time, popup.end_time)}
              </span>
            </div>
            <span
              className={cn(
                "relative line-clamp-3 text-lg font-bold leading-tight tracking-tight",
                popup.thumbnail_url && "text-white",
              )}
            >
              {popup.title}
            </span>
          </div>
          <div className="flex flex-col gap-0.5 px-3 py-2.5 shadow-[inset_0_1px_0_var(--line)]">
            <span className="line-clamp-1 text-sm font-bold tracking-tight text-ink">{popup.title}</span>
            <span className="text-[0.79rem] text-soft">{formatAddress(popup.address)}</span>
            <span className="mt-0.5 inline-flex items-center gap-1 font-mono text-[0.67rem] text-soft">
              {formatDateRangeShort(popup.start_time, popup.end_time)} ·
              <IconHeartFilled size={11} aria-hidden /> {popup.like_count}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}

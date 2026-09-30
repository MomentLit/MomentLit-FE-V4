"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/shared/lib";
import { fetchPopups } from "@/entities/popup";
import { getErrorMessage } from "@/shared/api/error";
import { formatAddress, formatDateRangeShort, popupBadge, toneForIndex } from "../lib/format";
import { TONE_ON_BG } from "./tone-dot";

const PAGE_SIZE = 4;

/** "최근에 등록된 팝업" — real `GET /popups` (createdAt desc), 4 most recent. */
export function RecentPopupCards() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["popups", "recent", PAGE_SIZE],
    queryFn: () => fetchPopups({ page: 0, size: PAGE_SIZE }),
  });

  const popups = data?.content ?? [];

  return (
    <section className="border-b border-line px-7 py-6">
      <div className="mb-3.5 flex items-center justify-between gap-3.5">
        <h2 className="text-xl font-bold tracking-tight text-ink">최근에 등록된 팝업</h2>
        <Link
          href="/search"
          className="text-[0.65rem] font-medium uppercase tracking-[0.12em] text-soft hover:text-ink"
        >
          전체 보기
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {Array.from({ length: PAGE_SIZE }).map((_, i) => (
            <div key={i} className="aspect-2/3 animate-pulse rounded-xl border border-line bg-wash" />
          ))}
        </div>
      ) : isError ? (
        <p className="py-6 text-sm text-soft">팝업을 불러오지 못했어요. {getErrorMessage(error)}</p>
      ) : popups.length === 0 ? (
        <p className="py-6 text-sm text-soft">아직 등록된 팝업이 없어요.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {popups.map((popup) => (
            <Link
              key={popup.popup_id}
              href={`/popups/${popup.popup_id}`}
              className="group flex flex-col overflow-hidden rounded-xl border border-line bg-white transition-all duration-300 hover:-translate-y-1.5 hover:border-ink"
            >
              <div
                className={cn(
                  "relative flex aspect-2/3 flex-col justify-between overflow-hidden p-3.5",
                  !popup.thumbnail_url && TONE_ON_BG[toneForIndex(popup.popup_id)],
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
                    Popup
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
                <span className="mt-0.5 font-mono text-[0.67rem] text-soft">
                  {formatDateRangeShort(popup.start_time, popup.end_time)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

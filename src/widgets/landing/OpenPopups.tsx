"use client";

import { MediaPhoto } from "@/shared/ui/MediaPhoto";
import { getErrorMessage } from "@/shared/api/error";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { fetchPopups } from "@/entities/popup";
import { toneForIndex, formatAddress, formatDateRangeShort, popupBadge } from "@/widgets/app-dashboard/lib/format";
import { Reveal } from "./Reveal";

const TONE_BG: Record<string, string> = {
  sky: "bg-sky",
  lime: "bg-lime",
  lemon: "bg-lemon",
  coral: "bg-coral",
  rose: "bg-rose",
  violet: "bg-violet",
};

/** "지금 열려 있는 팝업" — 실제 등록된 팝업 최신 3건(`GET /popups`). 없으면 빈 상태를 보여준다. */
export function OpenPopups() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["popups", "landing", 3],
    queryFn: () => fetchPopups({ page: 0, size: 3 }),
  });
  const popups = data?.content ?? [];

  return (
    <section className="border-b border-line px-4 py-11 sm:px-6 sm:py-16 lg:py-20">
      <Reveal className="mb-6 flex flex-col items-start gap-3 sm:mb-8">
        <h2
          className="text-[clamp(1.5rem,3.2vw,2.4rem)] leading-[1.2] tracking-tight text-ink"
          style={{ fontFamily: "var(--font-display)" }}
        >
          지금 열려 있는 팝업
        </h2>
        <p className="max-w-[60ch] text-[0.89rem] leading-[1.75] text-soft">
          새로운 브랜드와 뜻밖의 만남. 지금 시작하는 팝업을 살펴보세요.
        </p>
      </Reveal>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="팝업 불러오는 중">
          {[0, 1, 2].map((index) => <div key={index} className="aspect-[3/2] animate-pulse border border-line bg-wash" />)}
        </div>
      ) : isError ? (
        <p role="status" className="py-6 text-sm text-soft">팝업을 불러오지 못했어요. {getErrorMessage(error)}</p>
      ) : popups.length === 0 ? (
        <p className="py-6 text-sm text-soft">아직 등록된 팝업이 없어요.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {popups.map((popup, i) => {
            const tone = toneForIndex(popup.popup_id + i);
            return (
              <Reveal key={popup.popup_id} delayMs={i * 80}>
                <Link
                  href={`/popups/${popup.popup_id}`}
                  className="group flex h-full flex-col interactive-card border border-line bg-white"
                >
                  <div
                    className={`relative flex aspect-[3/2] flex-col justify-between overflow-hidden p-3.5 text-ink ${TONE_BG[tone]}`}
                  >
                    {popup.thumbnail_url && (
                      <>
                        <MediaPhoto src={popup.thumbnail_url} alt={`${popup.title} 대표 사진`} className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/40" />
                      </>
                    )}
                    <div className={`relative flex items-start justify-between gap-2 ${popup.thumbnail_url ? "text-white" : "text-ink"}`}>
                      <span
                        className="text-[0.61rem] font-medium uppercase tracking-[0.13em] opacity-70"
                        style={{ fontFamily: "var(--font-label)" }}
                      >
                        Popup store
                      </span>
                      <span
                        className="whitespace-nowrap bg-ink px-2 py-[3px] text-[0.63rem] font-medium text-white"
                        style={{ fontFamily: "var(--font-label)" }}
                      >
                        {popupBadge(popup.start_time, popup.end_time)}
                      </span>
                    </div>
                    <span
                      className={`relative line-clamp-3 text-[clamp(1.1rem,1.85vw,1.4rem)] leading-[1.26] tracking-tight ${popup.thumbnail_url ? "text-white" : "text-ink"}`}
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      {popup.title}
                    </span>
                    <i className="absolute inset-x-0 bottom-0 h-1 origin-left scale-x-0 bg-ink transition-transform duration-300 group-hover:scale-x-100" />
                  </div>
                  <div className="flex flex-col gap-0.5 px-3.5 py-3 shadow-[inset_0_1px_0_var(--line)]">
                    <span className="line-clamp-1 text-sm font-bold tracking-tight text-ink">{popup.title}</span>
                    <span className="text-[0.79rem] text-soft">{formatAddress(popup.address)}</span>
                    <span className="mt-0.5 text-[0.67rem] text-soft" style={{ fontFamily: "var(--font-label)" }}>
                      {formatDateRangeShort(popup.start_time, popup.end_time)}
                    </span>
                  </div>
                </Link>
              </Reveal>
            );
          })}
        </div>
      )}
    </section>
  );
}

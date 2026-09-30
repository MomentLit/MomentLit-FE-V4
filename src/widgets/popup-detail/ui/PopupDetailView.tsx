"use client";

import { useState } from "react";
import { IconHeart, IconHeartFilled, IconX, IconZoomIn } from "@tabler/icons-react";
import { isApiError, getErrorMessage } from "@/shared/api/error";
import { useAuthStore } from "@/entities/auth";
import { MediaPhoto } from "@/shared/ui/MediaPhoto";
import { Modal } from "@/shared/ui/Modal";
import { Card } from "@/shared/ui";
import { formatAddress, formatDateRange, popupBadge } from "../lib/format";
import {
  usePopupLikeStatusQuery,
  usePopupQuery,
  usePopupReviewsQuery,
  useTogglePopupLikeMutation,
} from "../model/queries";
import { PopupReviewSection } from "./PopupReviewSection";

/** 팝업 상세 — `GET /popups/{id}` + 리뷰/좋아요. Ported from space의 `SpaceDetailView` 구조. */
export function PopupDetailView({ popupId }: { popupId: number }) {
  const popupQuery = usePopupQuery(popupId);
  const reviewsQuery = usePopupReviewsQuery(popupId, popupQuery.isSuccess);
  const [isImageZoomed, setIsImageZoomed] = useState(false);

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const openAuthModal = useAuthStore((state) => state.openAuthModal);
  const likeStatusQuery = usePopupLikeStatusQuery(popupId);
  const likeMutation = useTogglePopupLikeMutation(popupId, likeStatusQuery.data?.is_liked ?? false);

  if (popupQuery.isPending) {
    return <div className="px-4 py-24 text-center text-sm text-soft">팝업 정보를 불러오는 중…</div>;
  }

  if (popupQuery.isError) {
    const notFound = isApiError(popupQuery.error) && popupQuery.error.response?.status === 404;
    return (
      <div className="px-4 py-24 text-center">
        <p className="text-lg font-semibold text-ink">
          {notFound ? "존재하지 않는 팝업이에요." : "팝업 정보를 불러오지 못했어요."}
        </p>
        {!notFound && <p className="mt-2 text-sm text-soft">{getErrorMessage(popupQuery.error)}</p>}
      </div>
    );
  }

  const popup = popupQuery.data;
  const likeCount = likeStatusQuery.data?.like_count ?? popup.like_count;
  const isLiked = likeStatusQuery.data?.is_liked ?? false;

  function handleLikeClick() {
    if (!isAuthenticated) {
      openAuthModal();
      return;
    }
    likeMutation.mutate();
  }

  return (
    <div className="page-shell">
      <Card
        tone={popup.thumbnail_url ? undefined : "violet"}
        className="relative flex min-h-[300px] flex-col justify-between gap-8 overflow-hidden p-6 sm:min-h-[420px] sm:p-10"
      >
        {popup.thumbnail_url && (
          <>
            <button type="button" onClick={() => setIsImageZoomed(true)} aria-label={`${popup.title} 대표 사진 확대`} className="absolute inset-0 cursor-zoom-in focus-visible:outline-offset-[-3px]">
              <MediaPhoto src={popup.thumbnail_url} alt={`${popup.title} 대표 사진`} className="h-full w-full object-cover" />
            </button>
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/50" />
            <button type="button" onClick={() => setIsImageZoomed(true)} className="button button--outline absolute right-4 top-4 z-10 sm:right-6 sm:top-6">
              <IconZoomIn size={18} stroke={2} aria-hidden />
              사진 확대
            </button>
          </>
        )}
        <span className={`pointer-events-none relative ${popup.thumbnail_url ? "pr-32" : ""} font-mono text-[0.66rem] font-medium uppercase tracking-[0.14em] ${popup.thumbnail_url ? "text-white" : "text-ink"}`}>
          {popupBadge(popup.start_time, popup.end_time)} · {formatAddress(popup.address)}
        </span>
        <div className={`pointer-events-none relative ${popup.thumbnail_url ? "text-white" : "text-ink"}`}>
          <h1 className="break-keep text-[clamp(2.2rem,5vw,4.5rem)] font-extrabold leading-tight tracking-tight">{popup.title}</h1>
          <p className="mt-2 text-sm opacity-90 sm:text-base">
            {popup.space_name} · {formatDateRange(popup.start_time, popup.end_time)}
          </p>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-b-3xl bg-line lg:grid-cols-[1fr_280px]">
        <div className="flex flex-col gap-9 bg-white p-5 sm:p-8">
          <section>
            <h3 className="mb-3 section-title text-ink">팝업 소개</h3>
            <p className="text-[0.92rem] leading-[1.9] text-soft">{popup.description}</p>
          </section>

          {popup.ai_brand_summary && (
            <section>
              <h3 className="mb-3 section-title text-ink">AI 브랜드 요약</h3>
              <p className="text-[0.92rem] leading-[1.9] text-soft">{popup.ai_brand_summary}</p>
            </section>
          )}

          <PopupReviewSection popupId={popupId} reviews={reviewsQuery.data ?? []} isLoading={reviewsQuery.isPending} />
        </div>

        <div className="flex flex-col gap-3 bg-white p-5 sm:p-6">
          <button
            type="button"
            onClick={handleLikeClick}
            aria-pressed={isLiked}
            disabled={likeMutation.isPending}
            className={`flex items-center justify-center gap-1.5 border px-3 py-2.5 text-sm font-semibold transition-colors ${
              isLiked ? "border-transparent bg-coral text-ink" : "border-line bg-white text-ink hover:border-line-2"
            }`}
          >
            {isLiked ? <IconHeartFilled size={16} aria-hidden /> : <IconHeart size={16} stroke={1.75} aria-hidden />}
            좋아요 <span className="tabular-nums">{likeCount}</span>
          </button>
          <div className="flex flex-col gap-1 border border-line p-3.5">
            <span className="text-xs font-bold text-soft">운영 공간</span>
            <b className="text-sm font-bold text-ink">{popup.space_name}</b>
          </div>
          <div className="flex flex-col gap-1 border border-line p-3.5">
            <span className="text-xs font-bold text-soft">운영 기간</span>
            <b className="text-sm font-bold text-ink">{formatDateRange(popup.start_time, popup.end_time)}</b>
          </div>
          <div className="flex flex-col gap-1 border border-line p-3.5">
            <span className="text-xs font-bold text-soft">조회수</span>
            <b className="text-sm font-bold text-ink">{popup.view_count.toLocaleString()}</b>
          </div>
        </div>
      </div>
      {isImageZoomed && popup.thumbnail_url && (
        <Modal label={`${popup.title} 대표 사진 확대`} onClose={() => setIsImageZoomed(false)} panelClassName="flex w-full max-w-[1200px] flex-col gap-4 overflow-y-auto bg-ink p-4 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="min-w-0 truncate text-lg font-bold text-white sm:text-2xl">{popup.title}</h2>
            <button type="button" onClick={() => setIsImageZoomed(false)} className="button button--inverse shrink-0">
              <IconX size={18} stroke={2} aria-hidden />
              닫기
            </button>
          </div>
          <MediaPhoto src={popup.thumbnail_url} alt={`${popup.title} 확대 사진`} className="max-h-[calc(100dvh-160px)] w-full object-contain" />
        </Modal>
      )}
    </div>
  );
}

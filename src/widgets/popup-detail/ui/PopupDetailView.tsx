"use client";

import { IconHeart, IconHeartFilled } from "@tabler/icons-react";
import { isApiError, getErrorMessage } from "@/shared/api/error";
import { useAuthStore } from "@/entities/auth";
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
    <div className="flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <Card
        tone="violet"
        className="flex aspect-[21/9] flex-col justify-between gap-8 rounded-3xl rounded-b-none p-6 sm:aspect-[21/7] sm:p-10"
      >
        <span className="font-mono text-[0.66rem] font-medium uppercase tracking-[0.14em]">
          {popupBadge(popup.start_time, popup.end_time)} · {formatAddress(popup.address)}
        </span>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">{popup.title}</h1>
          <p className="mt-2 text-sm opacity-90 sm:text-base">
            {popup.space_name} · {formatDateRange(popup.start_time, popup.end_time)}
          </p>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-b-3xl bg-line lg:grid-cols-[1fr_280px]">
        <div className="flex flex-col gap-9 bg-white p-5 sm:p-8">
          <section>
            <h3 className="mb-3 text-lg font-semibold tracking-tight text-ink">팝업 소개</h3>
            <p className="text-[0.92rem] leading-[1.9] text-soft">{popup.description}</p>
          </section>

          {popup.ai_brand_summary && (
            <section>
              <h3 className="mb-3 text-lg font-semibold tracking-tight text-ink">AI 브랜드 요약</h3>
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
            <span className="font-mono text-[0.6rem] uppercase tracking-wide text-soft">운영 공간</span>
            <b className="text-sm font-bold text-ink">{popup.space_name}</b>
          </div>
          <div className="flex flex-col gap-1 border border-line p-3.5">
            <span className="font-mono text-[0.6rem] uppercase tracking-wide text-soft">운영 기간</span>
            <b className="text-sm font-bold text-ink">{formatDateRange(popup.start_time, popup.end_time)}</b>
          </div>
          <div className="flex flex-col gap-1 border border-line p-3.5">
            <span className="font-mono text-[0.6rem] uppercase tracking-wide text-soft">조회수</span>
            <b className="text-sm font-bold text-ink">{popup.view_count.toLocaleString()}</b>
          </div>
        </div>
      </div>
    </div>
  );
}

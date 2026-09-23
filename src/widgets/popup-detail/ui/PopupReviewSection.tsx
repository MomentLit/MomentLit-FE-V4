"use client";

import { useState, type FormEvent } from "react";
import type { PopupReview, VerificationType } from "@/entities/review";
import { useAuthStore } from "@/entities/auth";
import { getErrorMessage } from "@/shared/api/error";
import { StarRating } from "@/shared/ui";
import { computePopupReviewSummary, useCreatePopupReviewMutation } from "../model/queries";

const VERIFICATION_LABELS: Record<VerificationType, string> = {
  QR: "QR 코드",
  RECEIPT: "영수증",
};

/** 로그인한 사용자는 누구나 작성 가능 — 대신 QR/영수증 인증 정보를 함께 제출해야 한다(백엔드가 나중에 검증). */
function ReviewComposer({ popupId }: { popupId: number }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const openAuthModal = useAuthStore((state) => state.openAuthModal);
  const createReview = useCreatePopupReviewMutation(popupId);

  const [rating, setRating] = useState(5);
  const [content, setContent] = useState("");
  const [verificationType, setVerificationType] = useState<VerificationType>("QR");
  const [verificationPayload, setVerificationPayload] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isAuthenticated) {
    return (
      <div className="rounded-xl border border-dashed border-line p-4 text-sm text-soft">
        <button type="button" onClick={openAuthModal} className="font-semibold text-ink underline">
          로그인
        </button>
        하고 방문 인증 정보를 남기면 리뷰를 작성할 수 있어요.
      </div>
    );
  }

  if (submitted) {
    return (
      <p className="rounded-xl bg-wash p-4 text-sm text-ink">
        리뷰가 등록되었습니다. 인증 확인 후 반영됩니다. 감사합니다!
      </p>
    );
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    createReview.mutate(
      { rating, content, verificationType, verificationPayload },
      {
        onSuccess: () => setSubmitted(true),
        onError: (submitError) => setError(getErrorMessage(submitError)),
      },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded-xl border border-line p-4">
      <label className="flex items-center gap-2 text-sm text-ink">
        평점
        <select
          value={rating}
          onChange={(event) => setRating(Number(event.target.value))}
          className="rounded-md border border-line px-2 py-1 text-sm"
        >
          {[5, 4, 3, 2, 1].map((value) => (
            <option key={value} value={value}>
              {value}점
            </option>
          ))}
        </select>
      </label>
      <textarea
        required
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder="방문 후기를 남겨주세요."
        rows={3}
        className="w-full resize-none rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-sky"
      />
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="flex items-center gap-2 text-sm text-ink">
          방문 인증
          <select
            value={verificationType}
            onChange={(event) => setVerificationType(event.target.value as VerificationType)}
            className="rounded-md border border-line px-2 py-1 text-sm"
          >
            {(Object.keys(VERIFICATION_LABELS) as VerificationType[]).map((type) => (
              <option key={type} value={type}>
                {VERIFICATION_LABELS[type]}
              </option>
            ))}
          </select>
        </label>
        <input
          required
          value={verificationPayload}
          onChange={(event) => setVerificationPayload(event.target.value)}
          placeholder={verificationType === "QR" ? "QR 코드 값" : "영수증 번호/내용"}
          className="flex-1 rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-sky"
        />
      </div>
      {error && <p className="text-sm text-coral">{error}</p>}
      <button
        type="submit"
        disabled={createReview.isPending}
        className="self-end bg-sky px-4 py-2 text-sm font-semibold text-ink transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {createReview.isPending ? "등록 중…" : "리뷰 등록"}
      </button>
    </form>
  );
}

export function PopupReviewSection({
  popupId,
  reviews,
  isLoading,
}: {
  popupId: number;
  reviews: PopupReview[];
  isLoading: boolean;
}) {
  const summary = computePopupReviewSummary(reviews);

  return (
    <section>
      <h3 className="mb-3 flex items-baseline gap-2 text-lg font-semibold tracking-tight text-ink">
        방문 후기
        {!isLoading && (
          <span className="font-mono text-[0.8rem] font-normal text-soft">
            {summary.count > 0 ? `${summary.average.toFixed(1)} · ${summary.count}건` : "0건"}
          </span>
        )}
      </h3>

      {isLoading ? (
        <p className="text-sm text-soft">리뷰를 불러오는 중…</p>
      ) : reviews.length === 0 ? (
        <p className="mb-4 text-sm text-soft">아직 등록된 리뷰가 없어요.</p>
      ) : (
        <div className="mb-4 flex flex-col gap-px overflow-hidden rounded-xl bg-line ring-1 ring-line">
          {reviews.map((review) => (
            <article key={review.popup_review_id} className="flex flex-col gap-2 bg-white p-4">
              <div className="flex items-center gap-2.5">
                <b className="text-[0.87rem] font-bold text-ink">{review.user_name}</b>
                <StarRating rating={review.rating} size={13} />
                {review.is_verified && (
                  <span className="bg-sky px-1.5 py-0.5 text-[0.63rem] font-bold text-ink">인증됨</span>
                )}
                <time className="ml-auto font-mono text-[0.68rem] text-soft">
                  {review.created_at.slice(0, 10)}
                </time>
              </div>
              <p className="text-[0.89rem] leading-[1.8] text-soft">{review.content}</p>
            </article>
          ))}
        </div>
      )}

      <ReviewComposer popupId={popupId} />
    </section>
  );
}

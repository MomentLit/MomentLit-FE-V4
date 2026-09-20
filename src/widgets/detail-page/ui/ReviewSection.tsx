"use client";

import { useState, type FormEvent } from "react";
import type { SpaceReview } from "@/entities/review";
import { useAuthStore } from "@/entities/auth";
import { getErrorMessage } from "@/shared/api/error";
import { StarRating } from "@/shared/ui";
import {
  computeReviewSummary,
  useCreateSpaceReviewMutation,
  useEligibleReviewMatchingQuery,
} from "../model/queries";

/** 로그인 + 완료된 예약(매칭)이 있는 사용자만 리뷰 작성 폼을 볼 수 있다 — 백엔드가 공간 리뷰를 매칭에 종속시키기 때문. */
function ReviewComposer({ spaceId }: { spaceId: number }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const openAuthModal = useAuthStore((state) => state.openAuthModal);
  const eligibleMatchingQuery = useEligibleReviewMatchingQuery(spaceId);
  const createReview = useCreateSpaceReviewMutation(spaceId);

  const [rating, setRating] = useState(5);
  const [content, setContent] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isAuthenticated) {
    return (
      <div className="rounded-xl border border-dashed border-line p-4 text-sm text-soft">
        <button type="button" onClick={openAuthModal} className="font-semibold text-ink underline">
          로그인
        </button>
        하고 예약을 완료하면 리뷰를 작성할 수 있어요.
      </div>
    );
  }

  if (eligibleMatchingQuery.isPending) {
    return <p className="text-sm text-soft">리뷰 작성 가능 여부를 확인하는 중…</p>;
  }

  const eligibleMatching = eligibleMatchingQuery.data;

  if (!eligibleMatching) {
    return (
      <p className="rounded-xl border border-dashed border-line p-4 text-sm text-soft">
        이 공간의 예약을 완료하면 리뷰를 작성할 수 있어요.
      </p>
    );
  }

  if (submitted) {
    return <p className="rounded-xl bg-wash p-4 text-sm text-ink">리뷰가 등록되었습니다. 감사합니다!</p>;
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    createReview.mutate(
      { matchingId: eligibleMatching.matching_id, rating, content },
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
        placeholder="이용 후기를 남겨주세요."
        rows={3}
        className="w-full resize-none rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-sky"
      />
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

/** 평균 평점 + 건수 헤더, 개별 리뷰(작성자/별점/날짜/본문), 리뷰 작성 폼. Ported from design-reference `.revs`/`.rev`. */
export function ReviewSection({
  spaceId,
  reviews,
  isLoading,
}: {
  spaceId: number;
  reviews: SpaceReview[];
  isLoading: boolean;
}) {
  const summary = computeReviewSummary(reviews);

  return (
    <section>
      <h3 className="mb-3 flex items-baseline gap-2 text-lg font-semibold tracking-tight text-ink">
        이용 후기
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
            <article key={review.space_review_id} className="flex flex-col gap-2 bg-white p-4">
              <div className="flex items-center gap-2.5">
                <b className="text-[0.87rem] font-bold text-ink">{review.user_name}</b>
                <StarRating rating={review.rating} size={13} />
                <time className="ml-auto font-mono text-[0.68rem] text-soft">
                  {review.created_at.slice(0, 10)}
                </time>
              </div>
              <p className="text-[0.89rem] leading-[1.8] text-soft">{review.content}</p>
            </article>
          ))}
        </div>
      )}

      <ReviewComposer spaceId={spaceId} />
    </section>
  );
}

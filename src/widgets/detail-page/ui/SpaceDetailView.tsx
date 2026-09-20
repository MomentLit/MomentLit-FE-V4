"use client";

import { isApiError, getErrorMessage } from "@/shared/api/error";
import {
  useAvailabilityQuery,
  useBookedDatesQuery,
  useHostStatsQuery,
  useSpaceQuery,
  useSpaceReviewsQuery,
} from "../model/queries";
import { DetailHero } from "./DetailHero";
import { SpaceInfoSection } from "./SpaceInfoSection";
import { ReviewSection } from "./ReviewSection";
import { BookingCard } from "./BookingCard";

/**
 * Space detail widget — composes hero + info/reviews + booking card against
 * the real backend (`GET /spaces/{id}` and friends). Ported from
 * design-reference `#p-detail`.
 */
export function SpaceDetailView({ spaceId }: { spaceId: number }) {
  const spaceQuery = useSpaceQuery(spaceId);
  const availabilityQuery = useAvailabilityQuery(spaceId, spaceQuery.isSuccess);
  const bookedDatesQuery = useBookedDatesQuery(spaceId, spaceQuery.isSuccess);
  const reviewsQuery = useSpaceReviewsQuery(spaceId, spaceQuery.isSuccess);
  const hostStatsQuery = useHostStatsQuery(spaceQuery.data?.host_id);

  if (spaceQuery.isPending) {
    return (
      <div className="px-4 py-24 text-center text-sm text-soft">
        공간 정보를 불러오는 중…
      </div>
    );
  }

  if (spaceQuery.isError) {
    const notFound = isApiError(spaceQuery.error) && spaceQuery.error.response?.status === 404;
    return (
      <div className="px-4 py-24 text-center">
        <p className="text-lg font-semibold text-ink">
          {notFound ? "존재하지 않는 공간이에요." : "공간 정보를 불러오지 못했어요."}
        </p>
        {!notFound && <p className="mt-2 text-sm text-soft">{getErrorMessage(spaceQuery.error)}</p>}
      </div>
    );
  }

  const space = spaceQuery.data;
  const statusBanner: Partial<Record<typeof space.admin_status, string>> = {
    PENDING: "이 공간은 아직 관리자 검토 중이에요. 승인되기 전까지는 검색 결과에 노출되지 않아요.",
    DRAFT: "아직 등록을 마치지 않은 임시 저장 상태예요. 관리자 검토 요청 전까지는 검색에 노출되지 않아요.",
    REJECTED: "이 공간은 검토 결과 승인이 거절됐어요. 공간 정보를 수정한 뒤 다시 등록해 주세요.",
  };
  const bannerMessage = statusBanner[space.admin_status];

  return (
    <div className="flex-1 px-4 py-8 sm:px-6 lg:px-8">
      {bannerMessage && (
        <p className="mb-4 shadow-[inset_3px_0_0_var(--coral)] bg-wash px-4.5 py-3 text-sm font-semibold text-ink">
          {bannerMessage}
        </p>
      )}
      <DetailHero space={space} />
      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-b-3xl bg-line lg:grid-cols-[1fr_330px]">
        <div className="flex flex-col gap-9 bg-white p-5 sm:p-8">
          <SpaceInfoSection space={space} />
          <ReviewSection
            spaceId={spaceId}
            reviews={reviewsQuery.data ?? []}
            isLoading={reviewsQuery.isPending}
          />
        </div>
        <div className="bg-white p-5 sm:p-6">
          <BookingCard
            space={space}
            spaceId={spaceId}
            availability={availabilityQuery.data ?? []}
            bookedDates={bookedDatesQuery.data ?? []}
            hostStats={hostStatsQuery.data}
            hostStatsLoading={hostStatsQuery.isPending}
          />
        </div>
      </div>
    </div>
  );
}

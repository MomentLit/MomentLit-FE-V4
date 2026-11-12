"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { IconArrowRight, IconExternalLink, IconHeart, IconHeartFilled } from "@tabler/icons-react";
import { Card } from "@/shared/ui";
import { useAuthStore } from "@/entities/auth";
import { getErrorMessage } from "@/shared/api/error";
import { createChatRoom } from "@/entities/message";
import {
  calculateBookingPrice,
  formatPriceAmount,
  getExternalBookingUrl,
  getExtraGuestFee,
  type SpaceAvailabilitySlot,
  type SpaceDetail,
} from "@/entities/space";
import { recordExternalBookingClick } from "@/entities/space/api";
import type { BookedTime, HostStats } from "@/entities/matching";
import type { MatchingCreateRequest } from "@/entities/matching";
import { Modal } from "@/shared/ui/Modal";
import { AvailabilityCalendar } from "./AvailabilityCalendar";
import {
  USAGE_UNIT_LABELS,
  consecutiveSlotsFrom,
  daySlotsForDate,
  timeToMinutes,
  useCreateMatchingMutation,
  useSpaceLikeStatusQuery,
  useToggleSpaceLikeMutation,
} from "../model/queries";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** 90 → "1시간 30분", 120 → "2시간" */
function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}분`;
  return rest === 0 ? `${hours}시간` : `${hours}시간 ${rest}분`;
}

function formatResponseRate(rate: number): string {
  const percent = rate <= 1 ? rate * 100 : rate;
  return `${Math.round(percent)}%`;
}

function formatResponseMinutes(minutes: number | null): string {
  if (minutes == null) return "정보 없음";
  if (minutes < 60) return `${Math.round(minutes)}분`;
  return `${Math.round(minutes / 60)}시간`;
}

/** 예약 요청 폼(날짜/시간/인원) + 좋아요 + 호스트 응답 통계. Ported from design-reference `.bookcard`/`.host`. */
export function BookingCard({
  space,
  spaceId,
  availability,
  bookedTimes,
  hostStats,
  hostStatsLoading,
}: {
  space: SpaceDetail;
  spaceId: number;
  availability: SpaceAvailabilitySlot[];
  bookedTimes: BookedTime[];
  hostStats: HostStats | undefined;
  hostStatsLoading: boolean;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const openAuthModal = useAuthStore((state) => state.openAuthModal);

  const contactHostMutation = useMutation({
    mutationFn: () => createChatRoom({ space_id: spaceId }),
    onSuccess: ({ chat_room_id }) => {
      // "chatRooms" 쿼리는 전역 staleTime(30s) 때문에, 방금 만든/재사용한 방이
      // 목록에 반영되기 전 캐시를 그대로 쓰면 /messages에서 room id를 못 찾아
      // 엉뚱한 대화(rooms[0])로 폴백해버린다 — 그래서 이동 전에 캐시를 비운다.
      queryClient.removeQueries({ queryKey: ["chatRooms"] });
      router.push(`/messages?room=${chat_room_id}`);
    },
    onError: (error) => setFeedback({ type: "error", message: getErrorMessage(error) }),
  });

  const minDate = useMemo(() => todayIso(), []);
  const [date, setDate] = useState(minDate);
  const [startKey, setStartKey] = useState<string | null>(null);
  const [endKey, setEndKey] = useState<string | null>(null);
  const [guestCount, setGuestCount] = useState(1);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [pendingRequest, setPendingRequest] = useState<MatchingCreateRequest | null>(null);
  const [confirmationError, setConfirmationError] = useState<string | null>(null);

  // 연속 예약을 켠 공간은 시작·종료 슬롯을 따로 골라 이어진 슬롯 여러 개를 한 번에 예약한다.
  // 꺼져 있으면(기존 공간 기본값) 지금처럼 슬롯 하나만 고른다.
  const allowConsecutive = space.allow_consecutive_booking === true;
  const daySlots = useMemo(() => daySlotsForDate(date, availability, bookedTimes), [availability, bookedTimes, date]);
  const openSlots = daySlots.filter((slot) => !slot.booked);
  const isDateFull = daySlots.length > 0 && openSlots.length === 0;

  const startSlot = openSlots.find((slot) => slot.start_time === startKey) ?? openSlots[0] ?? null;
  const endChoices = startSlot ? consecutiveSlotsFrom(daySlots, startSlot, allowConsecutive) : [];
  const durationOf = (end: SpaceAvailabilitySlot) =>
    startSlot ? timeToMinutes(end.end_time) - timeToMinutes(startSlot.start_time) : 0;
  // 최소 이용 시간은 시간 단위 공간에서만 — 종료를 아직 안 골랐으면 최소 시간을 채우는 첫 칸으로 맞춘다.
  const minUsageHours = space.usage_unit !== "DAILY" ? space.min_usage_hours ?? null : null;
  const minUsageMinutes = (minUsageHours ?? 0) * 60;
  const endSlot =
    endChoices.find((slot) => slot.end_time === endKey) ??
    endChoices.find((slot) => durationOf(slot) >= minUsageMinutes) ??
    endChoices[endChoices.length - 1] ??
    null;
  const durationMinutes = endSlot ? durationOf(endSlot) : 0;
  const meetsMinUsage = durationMinutes >= minUsageMinutes;

  const likeStatusQuery = useSpaceLikeStatusQuery(spaceId);
  const likeCount = likeStatusQuery.data?.like_count ?? space.like_count;
  const isLiked = likeStatusQuery.data?.is_liked ?? false;
  const likeMutation = useToggleSpaceLikeMutation(spaceId, isLiked);

  const createMatching = useCreateMatchingMutation();

  // 외부 예약 공간은 예약 요청 폼 대신 호스트 홈페이지로 보낸다. 예약 자체는 밖에서 일어나므로
  // 나가는 클릭만이라도 기록한다 — 응답을 기다리지 않아 이동이 막히지 않는다.
  const externalBookingUrl = getExternalBookingUrl(space);
  const handleExternalBookingClick = () => {
    void recordExternalBookingClick(spaceId).catch(() => undefined);
  };

  const pricePerHour = space.price_per_hour;
  // 서버가 같은 식으로 다시 계산해 저장한다(`BookingPriceCalculator`). 가격 문의 공간은 null → "가격 문의".
  const price = calculateBookingPrice(space, durationMinutes, guestCount);
  const totalPriceText = formatPriceAmount(price?.total ?? null);
  const durationLabel = space.usage_unit === "DAILY" ? "1일" : formatDuration(durationMinutes);
  const extraGuestFee = getExtraGuestFee(space);
  const unitLabel = space.usage_unit === "DAILY" ? "1일" : "시간";

  const handleDateChange = (value: string) => {
    setDate(value);
    setStartKey(null);
    setEndKey(null);
    setFeedback(null);
  };

  const handleLikeClick = () => {
    if (!isAuthenticated) {
      openAuthModal();
      return;
    }
    likeMutation.mutate();
  };

  const handleReserve = () => {
    if (!isAuthenticated) {
      openAuthModal();
      return;
    }
    if (isDateFull) {
      setFeedback({ type: "error", message: "이미 예약이 찬 날짜예요. 다른 날짜를 선택해주세요." });
      return;
    }
    if (!startSlot || !endSlot) {
      setFeedback({ type: "error", message: "선택한 날짜에는 예약 가능한 시간이 없어요." });
      return;
    }
    if (space.capacity != null && guestCount > space.capacity) {
      setFeedback({ type: "error", message: `이 공간의 최대 수용 인원은 ${space.capacity}명이에요.` });
      return;
    }
    if (!meetsMinUsage) {
      setFeedback({ type: "error", message: `이 공간은 최소 ${minUsageHours}시간 이상 예약할 수 있어요.` });
      return;
    }

    setFeedback(null);
    setConfirmationError(null);
    setPendingRequest({
      space_id: spaceId,
      start_time: `${date}T${startSlot.start_time}`,
      end_time: `${date}T${endSlot.end_time}`,
      total_price: String(price?.total ?? 0),
      guest_count: guestCount,
    });
  };

  const confirmReserve = () => {
    if (!pendingRequest || createMatching.isPending) return;
    setConfirmationError(null);
    createMatching.mutate(pendingRequest, {
      onSuccess: () => {
        setPendingRequest(null);
        setFeedback({ type: "success", message: "예약 요청을 보냈습니다." });
      },
      onError: (error) => setConfirmationError(getErrorMessage(error)),
    });
  };

  return (
    <Card className="sticky top-4 rounded-2xl p-5 shadow-[inset_0_0_0_1px_var(--color-ink)]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="whitespace-nowrap text-2xl font-semibold tracking-tight text-ink">
          {formatPriceAmount(pricePerHour)}
          {pricePerHour != null && (
            <>
              {" "}
              <small className="text-sm font-normal text-soft">
                / {space.usage_unit ? USAGE_UNIT_LABELS[space.usage_unit] : "이용 단위 미정"}
              </small>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={handleLikeClick}
          aria-pressed={isLiked}
          disabled={likeMutation.isPending}
          className={`flex w-[72px] flex-none items-center justify-center gap-1 border px-3 py-1.5 text-sm font-semibold transition-colors ${
            isLiked ? "border-transparent bg-coral text-ink" : "border-line bg-white text-ink hover:border-line-2"
          }`}
        >
          {isLiked ? <IconHeartFilled size={16} aria-hidden /> : <IconHeart size={16} stroke={1.75} aria-hidden />}
          <span className="tabular-nums">{likeCount}</span>
        </button>
      </div>

      {externalBookingUrl ? (
        <>
          <p className="mt-3 border border-line bg-wash px-3 py-2.5 text-sm leading-relaxed text-ink">
            이 공간은 호스트의 홈페이지에서 예약과 결제를 진행해요.
          </p>
          <a
            href={externalBookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleExternalBookingClick}
            className="button button--primary mt-2.5 w-full"
          >
            홈페이지에서 예약하기 <IconExternalLink size={16} stroke={2} aria-hidden />
          </a>
        </>
      ) : (
        <>
        <label
          className={`mt-3 flex flex-col gap-1 border px-3 py-2.5 ${isDateFull ? "border-coral" : "border-line"}`}
        >
          <span className="font-mono text-[0.58rem] uppercase tracking-wide text-soft">날짜</span>
          <input
            type="date"
            value={date}
            min={minDate}
            onChange={(event) => handleDateChange(event.target.value)}
            className="w-full appearance-none bg-transparent text-sm font-bold text-ink outline-none"
          />
        </label>
        {isDateFull && <p className="mt-1 text-[0.79rem] text-coral">이미 예약이 찬 날짜예요. 다른 날짜를 선택해주세요.</p>}

        <div className="mt-2">
          <AvailabilityCalendar
            availability={availability}
            bookedTimes={bookedTimes}
            selectedDate={date}
            onSelectDate={handleDateChange}
            minDate={minDate}
          />
        </div>

        <div className="mt-2 flex flex-col gap-1 border border-line px-3 py-2.5">
          <span className="font-mono text-[0.58rem] uppercase tracking-wide text-soft">시간</span>
          {isDateFull ? (
            <span className="text-sm text-soft">이 날짜는 이미 예약이 찼어요</span>
          ) : !startSlot || !endSlot ? (
            <span className="text-sm text-soft">이 날짜엔 예약 가능한 시간이 없어요</span>
          ) : allowConsecutive ? (
            <div className="flex items-center gap-2">
              <select
                aria-label="시작 시간"
                value={startSlot.start_time}
                onChange={(event) => {
                  setStartKey(event.target.value);
                  setEndKey(null);
                }}
                className="min-w-0 flex-1 appearance-none bg-transparent text-sm font-bold text-ink outline-none"
              >
                {openSlots.map((slot) => (
                  <option key={slot.start_time} value={slot.start_time}>
                    {slot.start_time.slice(0, 5)}
                  </option>
                ))}
              </select>
              <span className="text-soft" aria-hidden>—</span>
              <select
                aria-label="종료 시간"
                value={endSlot.end_time}
                onChange={(event) => setEndKey(event.target.value)}
                className="min-w-0 flex-1 appearance-none bg-transparent text-sm font-bold text-ink outline-none"
              >
                {endChoices.map((slot) => (
                  <option key={slot.end_time} value={slot.end_time}>
                    {slot.end_time.slice(0, 5)} ({formatDuration(durationOf(slot))})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <select
              aria-label="시간"
              value={startSlot.start_time}
              onChange={(event) => setStartKey(event.target.value)}
              className="w-full appearance-none bg-transparent text-sm font-bold text-ink outline-none"
            >
              {openSlots.map((slot) => (
                <option key={slot.start_time} value={slot.start_time}>
                  {slot.start_time.slice(0, 5)} — {slot.end_time.slice(0, 5)}
                </option>
              ))}
            </select>
          )}
        </div>
        {minUsageHours != null && (
          <p className={`mt-1 text-[0.76rem] ${startSlot && !meetsMinUsage ? "text-coral" : "text-soft"}`}>
            최소 {minUsageHours}시간 이상 예약할 수 있어요.
          </p>
        )}

        <label className="mt-2 flex flex-col gap-1 border border-line px-3 py-2.5">
          <span className="font-mono text-[0.58rem] uppercase tracking-wide text-soft">인원</span>
          <input
            type="number"
            min={1}
            max={space.capacity ?? undefined}
            value={guestCount}
            onChange={(event) => {
              const next = Math.max(1, Number(event.target.value) || 1);
              setGuestCount(space.capacity != null ? Math.min(next, space.capacity) : next);
            }}
            className="w-full appearance-none bg-transparent text-sm font-bold text-ink outline-none"
          />
        </label>
        {extraGuestFee && pricePerHour != null && (
          <p className="mt-1 text-[0.76rem] text-soft">
            기준 {extraGuestFee.baseGuestCount}명, 초과 시 1인당 {unitLabel} {formatPriceAmount(extraGuestFee.extraGuestFee)}이 추가돼요.
          </p>
        )}

        <div className="mt-2.5 min-h-5 text-sm text-soft">
          {startSlot && endSlot && (
            price && price.extraGuests > 0 ? (
              <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5">
                <dt>기본 요금 ({durationLabel})</dt>
                <dd className="text-right tabular-nums">{formatPriceAmount(price.baseAmount)}</dd>
                <dt>추가 인원 {price.extraGuests}명</dt>
                <dd className="text-right tabular-nums">{formatPriceAmount(price.extraAmount)}</dd>
                <dt className="text-ink">예상 금액</dt>
                <dd className="text-right font-bold tabular-nums text-ink">{totalPriceText}</dd>
              </dl>
            ) : (
              <p>
                예상 금액 <b className="text-ink">{totalPriceText}</b> ({durationLabel})
              </p>
            )
          )}
        </div>

        <button
          type="button"
          onClick={handleReserve}
          disabled={createMatching.isPending || isDateFull}
          className="button button--primary w-full"
        >
          {createMatching.isPending ? "요청 보내는 중…" : "예약 요청 보내기"} <IconArrowRight size={16} stroke={2} aria-hidden />
        </button>
        </>
      )}
      <button
        type="button"
        onClick={() => {
          if (!isAuthenticated) {
            openAuthModal();
            return;
          }
          contactHostMutation.mutate();
        }}
        disabled={contactHostMutation.isPending}
        className="mt-1.5 w-full border border-ink px-4 py-3 text-sm font-semibold text-ink transition-colors hover:bg-wash disabled:opacity-60"
      >
        {contactHostMutation.isPending ? "대화방 여는 중…" : "호스트에게 문의"}
      </button>

      {feedback && (
        <p className={`mt-2 text-sm ${feedback.type === "error" ? "text-coral" : "text-ink"}`}>
          {feedback.message}
        </p>
      )}

      <p className="mt-2.5 text-[0.76rem] leading-[1.7] text-soft">
        {externalBookingUrl
          ? "예약 링크는 새 탭에서 열려요. 결제는 모먼트릿에서 처리하지 않습니다."
          : "요청을 보내면 호스트가 승인 여부를 정합니다. 결제는 모먼트릿에서 처리하지 않습니다."}
      </p>

      {pendingRequest && createPortal(
        <Modal
          label="예약 요청 확인"
          onClose={() => { setPendingRequest(null); setConfirmationError(null); }}
          canClose={!createMatching.isPending}
          panelClassName="flex w-full max-w-md flex-col gap-5 overflow-y-auto border border-line bg-white p-5 sm:p-6"
        >
          <div>
            <h2 className="section-title text-ink">예약 요청을 보내시겠어요?</h2>
            <p className="mt-2 text-sm text-soft">내용을 확인한 뒤 요청을 보내주세요.</p>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 border-y border-line py-4 text-sm">
            <dt className="text-soft">공간</dt><dd className="min-w-0 break-words font-bold text-ink">{space.name}</dd>
            <dt className="text-soft">날짜</dt><dd className="font-bold text-ink">{pendingRequest.start_time.slice(0, 10)}</dd>
            <dt className="text-soft">시간</dt><dd className="font-bold text-ink">{pendingRequest.start_time.slice(11, 16)} — {pendingRequest.end_time.slice(11, 16)} ({durationLabel})</dd>
            <dt className="text-soft">인원</dt><dd className="font-bold text-ink">{pendingRequest.guest_count}명</dd>
            {price && price.extraGuests > 0 && (
              <>
                <dt className="text-soft">기본 요금</dt><dd className="font-bold text-ink">{formatPriceAmount(price.baseAmount)}</dd>
                <dt className="text-soft">추가 인원 요금</dt><dd className="font-bold text-ink">{formatPriceAmount(price.extraAmount)} ({price.extraGuests}명)</dd>
              </>
            )}
            <dt className="text-soft">예상 금액</dt><dd className="font-bold text-ink">{totalPriceText}</dd>
          </dl>
          <p className="text-sm leading-relaxed text-soft">호스트가 승인하면 예약이 확정됩니다. 결제는 모먼트릿에서 처리하지 않습니다.</p>
          {confirmationError && <p role="alert" className="text-sm text-coral">{confirmationError}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className="button button--outline" disabled={createMatching.isPending} onClick={() => { setPendingRequest(null); setConfirmationError(null); }}>취소</button>
            <button type="button" className="button button--primary" disabled={createMatching.isPending} onClick={confirmReserve}>
              {createMatching.isPending ? "요청 보내는 중…" : "요청 보내기"}
            </button>
          </div>
        </Modal>,
        document.body,
      )}

      <div className="mt-4 flex items-center gap-2.5 border-t border-line pt-3.5">
        {space.host_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- 외부 S3 URL, next/image 도메인 설정 없이 바로 렌더
          <img
            src={space.host_image_url}
            alt={space.host_name}
            className="h-[33px] w-[33px] flex-none object-cover"
          />
        ) : (
          <div
            aria-hidden
            className="grid h-[33px] w-[33px] flex-none place-items-center bg-violet text-[0.82rem] font-bold text-ink"
          >
            {space.host_name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="flex flex-col leading-tight">
          <b className="text-[0.87rem] font-bold text-ink">{space.host_name}</b>
          <span className="font-mono text-[0.68rem] text-soft">
            {hostStatsLoading
              ? "응답 정보 불러오는 중…"
              : hostStats
                ? `응답률 ${formatResponseRate(hostStats.response_rate)} · 평균 ${formatResponseMinutes(hostStats.avg_response_minutes)}`
                : "응답 정보 없음"}
          </span>
        </div>
      </div>
    </Card>
  );
}

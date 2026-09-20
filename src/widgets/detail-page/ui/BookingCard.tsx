"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { IconArrowRight, IconHeart, IconHeartFilled } from "@tabler/icons-react";
import { Card } from "@/shared/ui";
import { useAuthStore } from "@/entities/auth";
import { getErrorMessage } from "@/shared/api/error";
import { createChatRoom } from "@/entities/message";
import type { SpaceAvailabilitySlot, SpaceDetail } from "@/entities/space";
import type { HostStats } from "@/entities/matching";
import { AvailabilityCalendar } from "./AvailabilityCalendar";
import {
  USAGE_UNIT_LABELS,
  dayOfWeekForDate,
  slotDurationHours,
  useCreateMatchingMutation,
  useSpaceLikeStatusQuery,
  useToggleSpaceLikeMutation,
} from "../model/queries";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
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
  bookedDates,
  hostStats,
  hostStatsLoading,
}: {
  space: SpaceDetail;
  spaceId: number;
  availability: SpaceAvailabilitySlot[];
  bookedDates: string[];
  hostStats: HostStats | undefined;
  hostStatsLoading: boolean;
}) {
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const openAuthModal = useAuthStore((state) => state.openAuthModal);

  const contactHostMutation = useMutation({
    mutationFn: () => createChatRoom({ space_id: spaceId }),
    onSuccess: ({ chat_room_id }) => router.push(`/messages?room=${chat_room_id}`),
    onError: (error) => setFeedback({ type: "error", message: getErrorMessage(error) }),
  });

  const minDate = useMemo(() => todayIso(), []);
  const [date, setDate] = useState(minDate);
  const [slotKey, setSlotKey] = useState<string | null>(null);
  const [guestCount, setGuestCount] = useState(1);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const bookedDateSet = useMemo(() => new Set(bookedDates), [bookedDates]);
  const isDateBooked = bookedDateSet.has(date);

  const openSlots = useMemo(() => {
    if (isDateBooked) return [];
    const dayOfWeek = dayOfWeekForDate(date);
    return availability.filter((slot) => slot.is_open && slot.day_of_week === dayOfWeek);
  }, [availability, date, isDateBooked]);

  const selectedSlot =
    openSlots.find((slot) => `${slot.start_time}-${slot.end_time}` === slotKey) ?? openSlots[0] ?? null;

  const likeStatusQuery = useSpaceLikeStatusQuery(spaceId);
  const likeCount = likeStatusQuery.data?.like_count ?? space.like_count;
  const isLiked = likeStatusQuery.data?.is_liked ?? false;
  const likeMutation = useToggleSpaceLikeMutation(spaceId, isLiked);

  const createMatching = useCreateMatchingMutation();

  const hours = selectedSlot ? slotDurationHours(selectedSlot) : 0;
  // DAILY 공간의 price_per_hour는 이름과 달리 "1일 요금"이다 — 시간을 곱하면 하루치 슬롯
  // 하나를 몇 배로 청구하게 된다. HOURLY만 시간에 비례해서 계산한다.
  const totalPrice =
    space.usage_unit === "DAILY" ? space.price_per_hour : Math.round(space.price_per_hour * hours);

  const handleDateChange = (value: string) => {
    setDate(value);
    setSlotKey(null);
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
    if (isDateBooked) {
      setFeedback({ type: "error", message: "이미 예약이 찬 날짜예요. 다른 날짜를 선택해주세요." });
      return;
    }
    if (!selectedSlot) {
      setFeedback({ type: "error", message: "선택한 날짜에는 예약 가능한 시간이 없어요." });
      return;
    }
    if (space.capacity != null && guestCount > space.capacity) {
      setFeedback({ type: "error", message: `이 공간의 최대 수용 인원은 ${space.capacity}명이에요.` });
      return;
    }

    setFeedback(null);
    createMatching.mutate(
      {
        space_id: spaceId,
        start_time: `${date}T${selectedSlot.start_time}`,
        end_time: `${date}T${selectedSlot.end_time}`,
        total_price: String(totalPrice),
        guest_count: guestCount,
      },
      {
        onSuccess: () => setFeedback({ type: "success", message: "예약 요청을 보냈습니다." }),
        onError: (error) => setFeedback({ type: "error", message: getErrorMessage(error) }),
      },
    );
  };

  return (
    <Card className="sticky top-4 rounded-2xl p-5 shadow-[inset_0_0_0_1px_var(--color-ink)]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="whitespace-nowrap text-2xl font-semibold tracking-tight text-ink">
          {space.price_per_hour.toLocaleString()}원{" "}
          <small className="text-sm font-normal text-soft">
            / {space.usage_unit ? USAGE_UNIT_LABELS[space.usage_unit] : "이용 단위 미정"}
          </small>
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

      <label
        className={`mt-3 flex flex-col gap-1 border px-3 py-2.5 ${isDateBooked ? "border-coral" : "border-line"}`}
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
      {isDateBooked && <p className="mt-1 text-[0.79rem] text-coral">이미 예약이 찬 날짜예요. 다른 날짜를 선택해주세요.</p>}

      <div className="mt-2">
        <AvailabilityCalendar
          availability={availability}
          bookedDates={bookedDates}
          selectedDate={date}
          onSelectDate={handleDateChange}
          minDate={minDate}
        />
      </div>

      <label className="mt-2 flex flex-col gap-1 border border-line px-3 py-2.5">
        <span className="font-mono text-[0.58rem] uppercase tracking-wide text-soft">시간</span>
        {isDateBooked ? (
          <span className="text-sm text-soft">이 날짜는 이미 예약이 찼어요</span>
        ) : openSlots.length === 0 ? (
          <span className="text-sm text-soft">이 날짜엔 예약 가능한 시간이 없어요</span>
        ) : (
          <select
            value={selectedSlot ? `${selectedSlot.start_time}-${selectedSlot.end_time}` : ""}
            onChange={(event) => setSlotKey(event.target.value)}
            className="w-full appearance-none bg-transparent text-sm font-bold text-ink outline-none"
          >
            {openSlots.map((slot) => {
              const key = `${slot.start_time}-${slot.end_time}`;
              return (
                <option key={key} value={key}>
                  {slot.start_time.slice(0, 5)} — {slot.end_time.slice(0, 5)}
                </option>
              );
            })}
          </select>
        )}
      </label>

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

      {selectedSlot && (
        <p className="mt-2.5 text-sm text-soft">
          예상 금액 <b className="text-ink">{totalPrice.toLocaleString()}원</b> (
          {space.usage_unit === "DAILY" ? "1일" : `${hours}시간`})
        </p>
      )}

      <button
        type="button"
        onClick={handleReserve}
        disabled={createMatching.isPending || isDateBooked}
        className="mt-3 inline-flex w-full items-center justify-center gap-1.5 bg-sky px-4 py-3 text-sm font-semibold text-ink transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {createMatching.isPending ? "요청 보내는 중…" : "예약 요청 보내기"} <IconArrowRight size={16} stroke={2} aria-hidden />
      </button>
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
        요청을 보내면 호스트가 승인 여부를 정합니다. 결제는 모먼트릿에서 처리하지 않습니다.
      </p>

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

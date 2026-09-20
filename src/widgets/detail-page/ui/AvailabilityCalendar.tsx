"use client";

import { useState } from "react";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { cn } from "@/shared/lib";
import type { SpaceAvailabilitySlot } from "@/entities/space";
import { isDateOpen, toDateInputValue } from "../model/queries";

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
/** 예약은 가까운 미래 위주라 너무 먼 달까지 넘기게 둘 필요는 없다. */
const MAX_MONTHS_AHEAD = 3;

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

interface AvailabilityCalendarProps {
  availability: SpaceAvailabilitySlot[];
  bookedDates: string[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  minDate: string;
}

/**
 * 예약 가능한 날짜를 달력으로 보여준다 — 이전엔 `<input type="date">` 하나뿐이라
 * 날짜를 하나씩 찍어봐야만 그 날이 열려있는지 알 수 있었다. 주간 반복 가용시간
 * (`availability`)과 이미 찬 날짜(`bookedDates`)만으로 클라이언트에서 바로 계산할 수
 * 있어서 새 백엔드 엔드포인트 없이 만들 수 있었다.
 */
export function AvailabilityCalendar({
  availability,
  bookedDates,
  selectedDate,
  onSelectDate,
  minDate,
}: AvailabilityCalendarProps) {
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date(`${selectedDate}T00:00:00`)));

  const today = startOfMonth(new Date());
  const maxMonth = new Date(today.getFullYear(), today.getMonth() + MAX_MONTHS_AHEAD, 1);
  const canGoPrev = viewMonth.getTime() > today.getTime();
  const canGoNext = viewMonth.getTime() < maxMonth.getTime();

  const firstWeekday = viewMonth.getDay();
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(viewMonth.getFullYear(), viewMonth.getMonth(), i + 1)),
  ];

  function changeMonth(delta: number) {
    setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  }

  return (
    <div className="border border-line p-2.5">
      <div className="flex items-center justify-between px-1 pb-2">
        <button
          type="button"
          onClick={() => changeMonth(-1)}
          disabled={!canGoPrev}
          aria-label="이전 달"
          className="grid h-6 w-6 place-items-center text-ink disabled:opacity-30"
        >
          <IconChevronLeft size={14} stroke={2} />
        </button>
        <span className="text-[0.8rem] font-bold text-ink">
          {viewMonth.getFullYear()}년 {viewMonth.getMonth() + 1}월
        </span>
        <button
          type="button"
          onClick={() => changeMonth(1)}
          disabled={!canGoNext}
          aria-label="다음 달"
          className="grid h-6 w-6 place-items-center text-ink disabled:opacity-30"
        >
          <IconChevronRight size={14} stroke={2} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-[3px] text-center">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label} className="py-1 font-mono text-[0.63rem] text-soft">
            {label}
          </span>
        ))}
        {cells.map((date, i) => {
          if (!date) return <span key={`blank-${i}`} />;
          const value = toDateInputValue(date);
          const isPast = value < minDate;
          const open = !isPast && isDateOpen(value, availability, bookedDates);
          const isSelected = value === selectedDate;
          return (
            <button
              key={value}
              type="button"
              disabled={isPast || !open}
              onClick={() => onSelectDate(value)}
              title={isPast ? "지난 날짜" : open ? "예약 가능" : "예약 불가"}
              className={cn(
                "aspect-square text-[0.76rem] transition-colors",
                isPast && "text-soft/40",
                !isPast && !open && "text-soft/60",
                !isPast && open && !isSelected && "bg-sky/25 font-bold text-ink hover:bg-sky/50",
                isSelected && "bg-sky font-bold text-ink shadow-[inset_0_0_0_1.5px_var(--color-ink)]",
              )}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex items-center gap-3 px-1 font-mono text-[0.63rem] text-soft">
        <span className="flex items-center gap-1">
          <i className="block h-2 w-2 bg-sky/50" aria-hidden />
          예약 가능
        </span>
        <span className="flex items-center gap-1">
          <i className="block h-2 w-2 bg-wash" aria-hidden />
          불가
        </span>
      </div>
    </div>
  );
}

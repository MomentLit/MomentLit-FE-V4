import { useState } from "react";
import { cn } from "@/shared/lib";
import { fieldInputClass } from "./FormField";
import {
  BOOKING_UNIT_HOURS,
  DAYS,
  DAY_PRESETS,
  applyScheduleToDays,
  type BookingUnitHours,
  type Day,
  type WeeklySchedule,
} from "./model";

const timeInputClass = `${fieldInputClass} w-auto flex-none py-1.5 shadow-none ring-1 ring-line focus:ring-1 focus:ring-sky`;

export interface BulkSchedulePanelProps {
  schedule: WeeklySchedule;
  onApply: (schedule: WeeklySchedule) => void;
}

/**
 * "모두 동일 시간으로 설정" — 요일을 고르고 시간·예약 단위를 한 번만 입력해 주간 일정을 채운다.
 * 요일마다 다른 시간이 필요하면 적용 후 아래 요일별 목록에서 그 요일만 고치면 된다.
 */
export function BulkSchedulePanel({ schedule, onApply }: BulkSchedulePanelProps) {
  const [days, setDays] = useState<Set<Day>>(() => new Set(DAY_PRESETS[0].days));
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("18:00");
  const [unitHours, setUnitHours] = useState<BookingUnitHours>(2);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  function toggleDay(day: Day) {
    setDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
    setMessage(null);
  }

  function handleApply() {
    if (days.size === 0) {
      setMessage({ type: "error", text: "적용할 요일을 하나 이상 골라 주세요." });
      return;
    }
    if (endTime <= startTime) {
      setMessage({ type: "error", text: "종료 시간은 시작 시간보다 늦어야 합니다." });
      return;
    }
    const ordered = DAYS.filter((day) => days.has(day));
    onApply(applyScheduleToDays(schedule, ordered, { startTime, endTime, unitHours }));
    setMessage({ type: "success", text: `${ordered.join("·")} ${startTime}~${endTime}로 열었어요. 나머지 요일은 휴무예요.` });
  }

  return (
    <div className="flex flex-col gap-3 border border-ink bg-wash px-4 py-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-bold text-ink">모두 동일 시간으로 설정</span>
        <span className="text-[0.76rem] text-soft">요일마다 다르면 적용 후 아래 목록에서 그 요일만 고치세요.</span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {DAY_PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => {
              setDays(new Set(preset.days));
              setMessage(null);
            }}
            className="border border-line-2 bg-white px-2.5 py-1 text-xs font-bold text-ink hover:border-ink"
          >
            {preset.label}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-line-2" aria-hidden />
        {DAYS.map((day) => {
          const selected = days.has(day);
          return (
            <button
              key={day}
              type="button"
              aria-pressed={selected}
              onClick={() => toggleDay(day)}
              className={cn(
                "h-8 w-8 border text-sm font-bold transition-colors",
                selected ? "border-ink bg-ink text-white" : "border-line-2 bg-white text-ink hover:border-ink",
              )}
            >
              {day}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <input
          type="time"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          aria-label="일괄 시작 시간"
          className={timeInputClass}
        />
        <span className="text-soft" aria-hidden>
          —
        </span>
        <input
          type="time"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          aria-label="일괄 종료 시간"
          className={timeInputClass}
        />
        <select
          value={unitHours}
          onChange={(e) => setUnitHours(Number(e.target.value) as BookingUnitHours)}
          aria-label="일괄 예약 단위"
          className={timeInputClass}
        >
          {BOOKING_UNIT_HOURS.map((hours) => (
            <option key={hours} value={hours}>
              {hours}시간 단위
            </option>
          ))}
        </select>
        <button type="button" onClick={handleApply} className="button button--primary">
          선택한 요일에 적용
        </button>
      </div>

      {message && (
        <p role="status" className={cn("text-[0.79rem]", message.type === "error" ? "text-coral" : "text-ink")}>
          {message.text}
        </p>
      )}
    </div>
  );
}

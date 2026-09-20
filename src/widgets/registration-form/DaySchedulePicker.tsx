import { fieldInputClass } from "./FormField";
import { BOOKING_UNIT_HOURS, DAYS, type Day, type DaySchedule, type WeeklySchedule } from "./model";

export interface DaySchedulePickerProps {
  schedule: WeeklySchedule;
  onChange: (day: Day, patch: Partial<DaySchedule>) => void;
}

const timeInputClass = `${fieldInputClass} w-auto flex-none py-1.5 shadow-none ring-1 ring-line focus:ring-1 focus:ring-sky`;

/** 요일별로 운영 여부 + 시작/종료 시간 + 예약 단위(몇 시간씩 끊어 받을지)를 정한다. */
export function DaySchedulePicker({ schedule, onChange }: DaySchedulePickerProps) {
  return (
    <div className="flex flex-col gap-2">
      {DAYS.map((day) => {
        const daySchedule = schedule[day];
        return (
          <div
            key={day}
            className="flex flex-wrap items-center gap-2.5 border border-line px-3.5 py-2.5"
          >
            <label className="flex w-14 flex-none items-center gap-2 text-sm font-bold text-ink">
              <input
                type="checkbox"
                checked={daySchedule.isOpen}
                onChange={(e) => onChange(day, { isOpen: e.target.checked })}
                className="h-[15px] w-[15px] flex-none accent-sky"
              />
              {day}
            </label>

            {daySchedule.isOpen ? (
              <>
                <input
                  type="time"
                  value={daySchedule.startTime}
                  onChange={(e) => onChange(day, { startTime: e.target.value })}
                  aria-label={`${day}요일 시작 시간`}
                  className={timeInputClass}
                />
                <span className="text-soft" aria-hidden>
                  —
                </span>
                <input
                  type="time"
                  value={daySchedule.endTime}
                  onChange={(e) => onChange(day, { endTime: e.target.value })}
                  aria-label={`${day}요일 종료 시간`}
                  className={timeInputClass}
                />
                <select
                  value={daySchedule.unitHours}
                  onChange={(e) => onChange(day, { unitHours: Number(e.target.value) as DaySchedule["unitHours"] })}
                  aria-label={`${day}요일 예약 단위`}
                  className={timeInputClass}
                >
                  {BOOKING_UNIT_HOURS.map((hours) => (
                    <option key={hours} value={hours}>
                      {hours}시간 단위
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <span className="text-sm text-soft">휴무</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

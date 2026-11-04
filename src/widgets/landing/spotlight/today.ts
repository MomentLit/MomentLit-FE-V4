import type { SpaceAvailabilitySlot } from "@/entities/space";
import { JS_DAY_TO_DAY_OF_WEEK, toDateInputValue } from "@/widgets/detail-page/model/queries";

/** 오늘 운영 상태 — 서버엔 시간 단위 예약 현황이 없어서 "요일별 운영 시간 + 예약 마감일"로 판단한다. */
export type TodayStatus =
  | { kind: "open"; ranges: Array<[number, number]> }
  | { kind: "closed" } // 오늘 요일에 열어 둔 시간이 없음
  | { kind: "booked" }; // 오늘이 예약 마감일

const toHours = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h + (m || 0) / 60;
};

export function todayStatus(availability: SpaceAvailabilitySlot[], bookedDates: string[], now = new Date()): TodayStatus {
  if (bookedDates.includes(toDateInputValue(now))) return { kind: "booked" };
  const day = JS_DAY_TO_DAY_OF_WEEK[now.getDay()];
  const ranges = availability
    .filter((slot) => slot.is_open && slot.day_of_week === day)
    .map((slot): [number, number] => [toHours(slot.start_time), toHours(slot.end_time) || 24])
    .filter(([start, end]) => end > start)
    .sort((a, b) => a[0] - b[0]);
  // 호스트가 2시간 단위 칸으로 열어 두는 경우가 많아 이어진 칸은 하나로 합친다(10–12, 12–14 → 10–14).
  const merged: Array<[number, number]> = [];
  for (const [start, end] of ranges) {
    const last = merged.at(-1);
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }
  return merged.length ? { kind: "open", ranges: merged } : { kind: "closed" };
}

/** 일주일 중 한 번이라도 열어 둔 시간이 있는지 — "호스트가 일정을 열어 둔 곳"의 기준. */
export function hasOpenSchedule(availability: SpaceAvailabilitySlot[]) {
  return availability.some((slot) => slot.is_open);
}

const fmt = (hours: number) => `${String(Math.floor(hours)).padStart(2, "0")}:${String(Math.round((hours % 1) * 60)).padStart(2, "0")}`;

export function formatRanges(ranges: Array<[number, number]>) {
  return ranges.map(([start, end]) => `${fmt(start)}–${fmt(end)}`).join(" · ");
}

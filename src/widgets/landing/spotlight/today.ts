import type { SpaceAvailabilitySlot } from "@/entities/space";

/** 일주일 중 한 번이라도 열어 둔 시간이 있는지 — "호스트가 일정을 열어 둔 곳"의 기준. */
export function hasOpenSchedule(availability: SpaceAvailabilitySlot[]) {
  return availability.some((slot) => slot.is_open);
}

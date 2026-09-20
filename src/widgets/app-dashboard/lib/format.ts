import type { AddressResponse, UsageUnit } from "@/entities/space";
import type { SpectrumTone } from "@/shared/ui";

/** Deterministic color cycle for cards with no server-provided tone (e.g. popups have no category). */
const TONES: SpectrumTone[] = ["sky", "mint", "lime", "lemon", "apricot", "coral", "rose", "violet"];

export function toneForIndex(id: number): SpectrumTone {
  return TONES[Math.abs(id) % TONES.length];
}

/** `sido sigungu eup_myeon_dong`, matching the "서울 강남구 논현동" style the design uses. */
export function formatAddress(address: AddressResponse): string {
  return [address.sido, address.sigungu, address.eup_myeon_dong].filter(Boolean).join(" ");
}

export function usageUnitLabel(unit: UsageUnit | null): string {
  if (unit === "HOURLY") return "시간당";
  if (unit === "DAILY") return "일 단위";
  return "이용 단위 미정";
}

export function formatCapacityText(usageUnit: UsageUnit | null, capacity: number | null): string {
  const unit = usageUnitLabel(usageUnit);
  if (capacity == null) return unit;
  return `${unit} · 최대 ${capacity}인`;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** `MM.DD — MM.DD`, for a popup's active period. */
export function formatDateRangeShort(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const fmt = (d: Date) => `${pad2(d.getMonth() + 1)}.${pad2(d.getDate())}`;
  return `${fmt(start)} — ${fmt(end)}`;
}

/** `MM.DD HH:mm—HH:mm`, for a matching/reservation slot. */
export function formatReservationDateTime(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const dateStr = `${pad2(start.getMonth() + 1)}.${pad2(start.getDate())}`;
  const timeStr = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  return `${dateStr} ${timeStr(start)}—${timeStr(end)}`;
}

/** "D-3" / "진행 중" / "종료", based on the popup's start/end vs. now. */
export function popupBadge(startIso: string, endIso: string): string {
  const now = Date.now();
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return "";
  if (now < start) {
    const days = Math.ceil((start - now) / 86_400_000);
    return `D-${Math.max(days, 1)}`;
  }
  if (now <= end) return "진행 중";
  return "종료";
}

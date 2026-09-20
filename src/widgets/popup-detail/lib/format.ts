import type { AddressResponse } from "@/entities/space";

/** `sido sigungu eup_myeon_dong`, matching the "서울 강남구 논현동" style the design uses. */
export function formatAddress(address: AddressResponse): string {
  return [address.sido, address.sigungu, address.eup_myeon_dong].filter(Boolean).join(" ");
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** `YYYY.MM.DD — YYYY.MM.DD`, for a popup's full active period. */
export function formatDateRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const fmt = (d: Date) => `${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())}`;
  return `${fmt(start)} — ${fmt(end)}`;
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

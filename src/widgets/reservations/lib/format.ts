import type { AddressResponse } from "@/entities/space";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** `sido sigungu eup_myeon_dong`. */
export function formatAddress(address: AddressResponse): string {
  return [address.sido, address.sigungu, address.eup_myeon_dong].filter(Boolean).join(" ");
}

/** `MM.DD HH:mm—HH:mm`. */
export function formatReservationDateTime(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const dateStr = `${pad2(start.getMonth() + 1)}.${pad2(start.getDate())}`;
  const timeStr = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  return `${dateStr} ${timeStr(start)}—${timeStr(end)}`;
}

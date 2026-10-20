import { formatCapacityRange, type AddressResponse, type UsageUnit } from "@/entities/space";

/** `sido sigungu eup_myeon_dong`, matching the "서울 성동구 성수동" style the design uses. */
export function formatAddress(address: AddressResponse): string {
  return [address.sido, address.sigungu, address.eup_myeon_dong].filter(Boolean).join(" ");
}

export function usageUnitLabel(unit: UsageUnit | null): string {
  if (unit === "HOURLY") return "시간당";
  if (unit === "DAILY") return "일 단위";
  return "이용 단위 미정";
}

export function formatCapacityText(usageUnit: UsageUnit | null, capacity: number | null, minCapacity?: number | null): string {
  const unit = usageUnitLabel(usageUnit);
  const range = formatCapacityRange(minCapacity, capacity);
  return range ? `${unit} · ${range}` : unit;
}

export function formatPrice(pricePerHour: number, usageUnit: UsageUnit | null): string {
  const suffix = usageUnit === "DAILY" ? "/일" : "/시간";
  return `${pricePerHour.toLocaleString()}원${suffix}`;
}

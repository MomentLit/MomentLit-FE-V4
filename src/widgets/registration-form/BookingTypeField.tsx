import { cn } from "@/shared/lib";
import type { BookingType } from "@/entities/space";
import { FormField, fieldInputClass } from "./FormField";

const BOOKING_TYPES: { value: BookingType; label: string }[] = [
  { value: "INTERNAL", label: "모먼트릿에서 예약 받기" },
  { value: "EXTERNAL", label: "우리 홈페이지에서 예약 받기" },
];

export interface BookingTypeFieldProps {
  bookingType: BookingType;
  externalBookingUrl: string;
  onBookingTypeChange: (bookingType: BookingType) => void;
  onExternalBookingUrlChange: (url: string) => void;
}

/**
 * 예약 방식 — 자체 홈페이지로 예약을 받는 업체는 공간 정보만 노출하고 예약 링크로 보낸다.
 * 공간 등록(이용 조건 단계)과 공간 수정에서 같이 쓴다.
 */
export function BookingTypeField({
  bookingType,
  externalBookingUrl,
  onBookingTypeChange,
  onExternalBookingUrlChange,
}: BookingTypeFieldProps) {
  return (
    <>
      <FormField
        label="예약 방식"
        full
        hint={
          bookingType === "EXTERNAL"
            ? "공간 상세에 예약 요청 대신 '홈페이지에서 예약하기' 버튼이 보여요."
            : "예약 요청을 모먼트릿에서 받고 직접 승인·거절해요."
        }
      >
        <div role="radiogroup" aria-label="예약 방식" className="flex gap-0.5 bg-line">
          {BOOKING_TYPES.map(({ value, label }) => {
            const checked = bookingType === value;
            return (
              <label key={value} className="relative flex-1 cursor-pointer">
                <input
                  type="radio"
                  name="bookingType"
                  value={value}
                  checked={checked}
                  onChange={() => onBookingTypeChange(value)}
                  className="absolute h-0 w-0 opacity-0"
                />
                <span
                  className={cn(
                    "flex items-center justify-center px-4 py-3 text-center text-sm font-bold transition-colors",
                    checked ? "bg-primary-100 text-ink" : "bg-white text-ink hover:bg-wash",
                  )}
                >
                  {label}
                </span>
              </label>
            );
          })}
        </div>
      </FormField>

      {bookingType === "EXTERNAL" && (
        <FormField label="예약 페이지 링크" full>
          <input
            type="url"
            inputMode="url"
            value={externalBookingUrl}
            onChange={(e) => onExternalBookingUrlChange(e.target.value)}
            placeholder="https://example.com/reservation"
            aria-label="예약 페이지 링크"
            className={fieldInputClass}
          />
        </FormField>
      )}
    </>
  );
}

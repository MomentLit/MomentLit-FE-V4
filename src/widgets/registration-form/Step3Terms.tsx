import { cn } from "@/shared/lib";
import { FormField, fieldInputClass } from "./FormField";
import { BookingTypeField } from "./BookingTypeField";
import { OptionTabs, type OptionStepProps } from "./OptionTabs";
import { USAGE_UNIT_LABELS, type RegistrationFormState, type UsageUnit } from "./model";

export interface Step3TermsProps extends OptionStepProps {
  state: RegistrationFormState;
  onFieldChange: <K extends keyof RegistrationFormState>(
    key: K,
    value: RegistrationFormState[K],
  ) => void;
}

const USAGE_UNITS: UsageUnit[] = ["HOURLY", "DAILY"];

/**
 * Step 3 — 이용 조건. Not rendered in design-reference.html (stepper label
 * only, see ANALYSIS.md §2.6) — filled in per the task brief: 면적/최대인원
 * already live on Step 1, so this covers usage unit, rate, minimum usage
 * time and floor, plus 공간 공통 이용 안내·연락처·예약 방식.
 */
export function Step3Terms({ state, onFieldChange, optionTabs, onOptionChange }: Step3TermsProps) {
  const option = optionTabs.options[optionTabs.activeIndex];
  const rateLabel = option.usageUnit === "HOURLY" ? "시간당 요금 (원)" : "일당 요금 (원)";

  return (
    <div className="grid grid-cols-1 gap-4.5 sm:grid-cols-2">
      <FormField
        label="이용 안내 (선택)"
        full
        hint="문의 방법, 주의사항, 이용 규칙, 주차 안내 등을 자유롭게 적어 주세요. 공간 상세에 그대로 보여요."
      >
        <textarea
          value={state.usageNotice}
          onChange={(e) => onFieldChange("usageNotice", e.target.value)}
          placeholder={"예)\n· 문의는 메시지로 남겨 주세요\n· 음식물 반입 불가, 퇴실 시 원상 복구\n· 건물 내 주차 2대 무료"}
          aria-label="이용 안내"
          maxLength={5000}
          className={`${fieldInputClass} min-h-[160px] resize-y leading-[1.7]`}
        />
      </FormField>

      <FormField label="연락처 (선택)" full hint="입력하면 공간 상세에 공개되고, 게스트가 눌러서 바로 전화할 수 있어요.">
        <input
          type="tel"
          inputMode="tel"
          value={state.phone}
          onChange={(e) => onFieldChange("phone", e.target.value)}
          placeholder="예: 02-123-4567"
          aria-label="연락처"
          className={fieldInputClass}
        />
      </FormField>

      <BookingTypeField
        bookingType={state.bookingType}
        externalBookingUrl={state.externalBookingUrl}
        onBookingTypeChange={(bookingType) => onFieldChange("bookingType", bookingType)}
        onExternalBookingUrlChange={(url) => onFieldChange("externalBookingUrl", url)}
      />
      <OptionTabs {...optionTabs}>
        <FormField label="이용 단위" full>
          <div role="radiogroup" aria-label="이용 단위" className="flex gap-0.5 bg-line">
            {USAGE_UNITS.map((unit) => {
              const checked = option.usageUnit === unit;
              return (
                <label key={unit} className="relative flex-1 cursor-pointer">
                  <input
                    type="radio"
                    name="usageUnit"
                    value={unit}
                    checked={checked}
                    onChange={() => onOptionChange("usageUnit", unit)}
                    className="absolute h-0 w-0 opacity-0"
                  />
                  <span
                    className={cn(
                      "flex items-center justify-center px-4 py-3 text-sm font-bold transition-colors",
                      checked ? "bg-primary-100 text-ink" : "bg-white text-ink hover:bg-wash",
                    )}
                  >
                    {USAGE_UNIT_LABELS[unit]}
                  </span>
                </label>
              );
            })}
          </div>
        </FormField>

        <FormField label={rateLabel}>
          <input
            type="number"
            min={0}
            value={option.pricePerUnit}
            onChange={(e) => onOptionChange("pricePerUnit", e.target.value)}
            aria-label={rateLabel}
            className={fieldInputClass}
          />
        </FormField>

        <FormField label="최소 이용 시간">
          <input
            type="number"
            min={0}
            value={option.minUsageHours}
            onChange={(e) => onOptionChange("minUsageHours", e.target.value)}
            aria-label="최소 이용 시간"
            className={fieldInputClass}
          />
        </FormField>

        <FormField label="층수">
          <input
            type="text"
            value={option.floor}
            onChange={(e) => onOptionChange("floor", e.target.value)}
            placeholder="예: 2층"
            aria-label="층수"
            className={fieldInputClass}
          />
        </FormField>
      </OptionTabs>
    </div>
  );
}

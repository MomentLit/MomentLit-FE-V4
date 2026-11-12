import { cn } from "@/shared/lib";
import { FormField, fieldInputClass } from "./FormField";
import { PriceField } from "./PriceField";
import { BookingTypeField } from "./BookingTypeField";
import { BookingRulesFields } from "./BookingRulesFields";
import { OptionTabs, type OptionStepProps } from "./OptionTabs";
import { USAGE_UNIT_LABELS, type RegistrationFormState, type SpaceOptionState, type UsageUnit } from "./model";

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
 * time, parking and floor.
 */
export function Step3Terms({ state, onFieldChange, optionTabs, onOptionChange }: Step3TermsProps) {
  const option = optionTabs.options[optionTabs.activeIndex];
  const rateLabel = option.usageUnit === "HOURLY" ? "시간당 요금 (원)" : "일당 요금 (원)";

  return (
    <div className="grid grid-cols-1 gap-4.5 sm:grid-cols-2">
      <FormField label="주차 정보" full>
        <input
          type="text"
          value={state.parkingInfo}
          onChange={(e) => onFieldChange("parkingInfo", e.target.value)}
          placeholder="예: 건물 내 2대 무료"
          aria-label="주차 정보"
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

        <PriceField
          label={rateLabel}
          price={option.pricePerUnit}
          priceInquiry={option.priceInquiry}
          onPriceChange={(price) => onOptionChange("pricePerUnit", price)}
          onPriceInquiryChange={(priceInquiry) => onOptionChange("priceInquiry", priceInquiry)}
        />

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

        {/* 외부 예약 공간은 모먼트릿에서 예약을 받지 않으니 예약 규칙도 의미가 없다. */}
        {state.bookingType !== "EXTERNAL" && (
          <BookingRulesFields
            rules={option}
            usageUnit={option.usageUnit}
            onChange={(key, value) => onOptionChange(key, value as SpaceOptionState[typeof key])}
          />
        )}
      </OptionTabs>
    </div>
  );
}

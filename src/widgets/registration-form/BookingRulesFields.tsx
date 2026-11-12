import { cn } from "@/shared/lib";
import { FormField, fieldInputClass } from "./FormField";
import { ToggleSwitch } from "./ToggleSwitch";
import type { BookingRulesState, UsageUnit } from "./model";

export interface BookingRulesFieldsProps {
  rules: BookingRulesState;
  usageUnit: UsageUnit | null;
  onChange: <K extends keyof BookingRulesState>(key: K, value: BookingRulesState[K]) => void;
}

/**
 * 연속 예약 · 최소 이용 시간 · 인원 초과 요금. 등록 마법사(구역마다)와 수정 폼이 같이 쓴다.
 * 그리드 두 칸을 다 쓰는 항목들이라 부모는 `sm:grid-cols-2` 폼 안에 그대로 넣으면 된다.
 */
export function BookingRulesFields({ rules, usageUnit, onChange }: BookingRulesFieldsProps) {
  const isDaily = usageUnit === "DAILY";
  const unitLabel = isDaily ? "1일" : "시간";

  return (
    <>
      <FormField
        label="연속 예약"
        full
        hint={
          rules.allowConsecutiveBooking
            ? "게스트가 이어진 예약 시간을 여러 칸 묶어 한 번에 예약할 수 있어요. 예: 2시간 단위면 10–12시 + 12–14시."
            : "게스트는 예약 시간 한 칸만 골라 예약할 수 있어요."
        }
      >
        <div>
          <ToggleSwitch
            checked={rules.allowConsecutiveBooking}
            onChange={(checked) => onChange("allowConsecutiveBooking", checked)}
            label="이어진 시간 묶어서 예약받기"
          />
        </div>
      </FormField>

      {!isDaily && (
        <FormField label="최소 이용 시간" hint="비워 두면 제한이 없어요.">
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              step={1}
              value={rules.minUsageHours}
              onChange={(e) => onChange("minUsageHours", e.target.value)}
              aria-label="최소 이용 시간"
              className={cn(fieldInputClass, "min-w-0 flex-1")}
            />
            <span className="flex-none text-sm text-soft">시간 이상</span>
          </div>
        </FormField>
      )}

      <FormField
        label="인원 추가 요금"
        full
        hint={
          rules.extraGuestEnabled
            ? `기준 인원을 넘는 인원 1명마다 ${unitLabel} 요금이 더해져요. 예약 금액에 자동으로 계산돼요.`
            : "인원과 상관없이 같은 요금을 받아요."
        }
      >
        <div className="flex flex-col gap-2.5">
          <div>
            <ToggleSwitch
              checked={rules.extraGuestEnabled}
              onChange={(checked) => onChange("extraGuestEnabled", checked)}
              label="인원에 따라 추가 요금 받기"
            />
          </div>
          {rules.extraGuestEnabled && (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <label className="flex items-center gap-2">
                <span className="w-16 flex-none text-sm font-bold text-ink">기준 인원</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={rules.baseGuestCount}
                  onChange={(e) => onChange("baseGuestCount", e.target.value)}
                  className={cn(fieldInputClass, "min-w-0 flex-1")}
                />
                <span className="flex-none text-sm text-soft">명까지</span>
              </label>
              <label className="flex items-center gap-2">
                <span className="w-16 flex-none text-sm font-bold text-ink">초과 1인당</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={rules.extraGuestFee}
                  onChange={(e) => onChange("extraGuestFee", e.target.value)}
                  className={cn(fieldInputClass, "min-w-0 flex-1")}
                />
                <span className="flex-none text-sm text-soft">원 / {unitLabel}</span>
              </label>
            </div>
          )}
        </div>
      </FormField>
    </>
  );
}

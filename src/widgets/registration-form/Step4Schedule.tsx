import { useState } from "react";
import { FormField } from "./FormField";
import { DaySchedulePicker } from "./DaySchedulePicker";
import { BulkSchedulePanel } from "./BulkSchedulePanel";
import { OptionTabs, type OptionStepProps } from "./OptionTabs";
import { usesWeeklySchedule, type Day, type DaySchedule, type RegistrationFormState } from "./model";

export interface Step4ScheduleProps extends OptionStepProps {
  state: RegistrationFormState;
  onFieldChange: <K extends keyof RegistrationFormState>(
    key: K,
    value: RegistrationFormState[K],
  ) => void;
}

/** Step 4 — 일정 열기. 요일별로 운영 시간대와 예약 단위(몇 시간씩 끊어 받을지)를 직접 정한다. */
export function Step4Schedule({ state, onFieldChange, optionTabs, onOptionChange }: Step4ScheduleProps) {
  const option = optionTabs.options[optionTabs.activeIndex];
  const [copiedToOthers, setCopiedToOthers] = useState(false);

  /** 지금 구역의 주간 일정을 다른 구역에도 그대로 복사한다. */
  function applyToAllOptions() {
    onFieldChange(
      "options",
      state.options.map((other) =>
        other.id === option.id ? other : { ...other, weeklySchedule: structuredClone(option.weeklySchedule) },
      ),
    );
    setCopiedToOthers(true);
  }

  function updateDay(day: Day, patch: Partial<DaySchedule>) {
    setCopiedToOthers(false);
    onOptionChange("weeklySchedule", {
      ...option.weeklySchedule,
      [day]: { ...option.weeklySchedule[day], ...patch },
    });
  }

  if (!usesWeeklySchedule(state)) {
    return (
      <div className="grid grid-cols-1 gap-4.5">
        <div className="shadow-[inset_3px_0_0_var(--sky)] bg-wash px-4.5 py-4 text-[0.88rem] leading-[1.75] text-ink">
          <b>일정은 설정하지 않아도 돼요.</b>
          <br />
          3단계에서 &lsquo;우리 홈페이지에서 예약 받기&rsquo;를 선택해서, 예약은 입력하신 홈페이지 링크에서 받아요.
          공간 상세에는 예약 요청 대신 &lsquo;홈페이지에서 예약하기&rsquo; 버튼이 보여요.
        </div>

        <div className="shadow-[inset_3px_0_0_var(--sky)] bg-wash px-4.5 py-4 text-[0.88rem] leading-[1.75] text-soft">
          등록해도 바로 공개되지 않습니다. 검토 후 목록에 올라갑니다. 모먼트릿은 결제를 처리하지 않습니다.
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4.5">
      <OptionTabs {...optionTabs}>
        <FormField
          label="요일별 운영 시간"
          full
          hint="요일과 시간을 한 번에 정하고, 다른 요일만 아래에서 고치세요. 예: 10:00~18:00를 2시간 단위로 열면 게스트가 10-12시/12-14시/14-16시/16-18시 중 원하는 시간대를 골라 예약합니다."
        >
          <div className="flex flex-col gap-3">
            {/* 구역을 바꾸면 패널 입력값도 처음부터 — 다른 구역 설정이 섞여 보이지 않게 */}
            <BulkSchedulePanel
              key={option.id}
              schedule={option.weeklySchedule}
              onApply={(schedule) => {
                onOptionChange("weeklySchedule", schedule);
                setCopiedToOthers(false);
              }}
            />
            <DaySchedulePicker schedule={option.weeklySchedule} onChange={updateDay} />
          </div>
        </FormField>

        {state.options.length > 1 && (
          <div className="flex flex-wrap items-center gap-2.5">
            <button type="button" onClick={applyToAllOptions} className="button button--outline">
              이 일정을 다른 구역에도 적용
            </button>
            {copiedToOthers && (
              <span role="status" className="text-[0.79rem] text-soft">
                모든 구역에 같은 일정을 적용했어요.
              </span>
            )}
          </div>
        )}
      </OptionTabs>

      <div className="shadow-[inset_3px_0_0_var(--sky)] bg-wash px-4.5 py-4 text-[0.88rem] leading-[1.75] text-soft">
        등록해도 바로 공개되지 않습니다. 검토 후 목록에 올라가며, 예약 요청을 받을지는
        항상 호스트가 정합니다. 모먼트릿은 결제를 처리하지 않습니다.
      </div>
    </div>
  );
}

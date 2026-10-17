import { FormField } from "./FormField";
import { DaySchedulePicker } from "./DaySchedulePicker";
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
export function Step4Schedule({ state, optionTabs, onOptionChange }: Step4ScheduleProps) {
  const option = optionTabs.options[optionTabs.activeIndex];

  function updateDay(day: Day, patch: Partial<DaySchedule>) {
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
          hint="요일을 켜고 시작~종료 시간과 예약 단위를 정하세요. 예: 10:00~18:00를 2시간 단위로 열면 게스트가 10-12시/12-14시/14-16시/16-18시 중 원하는 시간대를 골라 예약합니다."
        >
          <DaySchedulePicker schedule={option.weeklySchedule} onChange={updateDay} />
        </FormField>
      </OptionTabs>

      <div className="shadow-[inset_3px_0_0_var(--sky)] bg-wash px-4.5 py-4 text-[0.88rem] leading-[1.75] text-soft">
        등록해도 바로 공개되지 않습니다. 검토 후 목록에 올라가며, 예약 요청을 받을지는
        항상 호스트가 정합니다. 모먼트릿은 결제를 처리하지 않습니다.
      </div>
    </div>
  );
}

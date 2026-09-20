import { FormField, fieldInputClass } from "./FormField";
import type { RegistrationFormState } from "./model";

export interface Step2LocationProps {
  state: RegistrationFormState;
  onFieldChange: <K extends keyof RegistrationFormState>(
    key: K,
    value: RegistrationFormState[K],
  ) => void;
}

/**
 * Step 2 — 위치. Not rendered in design-reference.html (stepper label only,
 * see ANALYSIS.md §2.6) — filled in with a plain address form as instructed.
 * A real address-search API (Kakao/Daum) integration is out of scope here;
 * text inputs are enough for the prototype. Fields mirror the backend's
 * `AddressRequest` (entities/space/model.ts) so submission needs no guessing:
 * `road_address` and `postal_code` are required there (jibun_address is the
 * only optional field this prototype skips).
 */
export function Step2Location({ state, onFieldChange }: Step2LocationProps) {
  return (
    <div className="grid grid-cols-1 gap-4.5 sm:grid-cols-2">
      <FormField label="시 / 도">
        <input
          type="text"
          value={state.sido}
          onChange={(e) => onFieldChange("sido", e.target.value)}
          placeholder="예: 서울특별시"
          aria-label="시/도"
          className={fieldInputClass}
        />
      </FormField>

      <FormField label="시 / 군 / 구">
        <input
          type="text"
          value={state.sigungu}
          onChange={(e) => onFieldChange("sigungu", e.target.value)}
          placeholder="예: 마포구"
          aria-label="시/군/구"
          className={fieldInputClass}
        />
      </FormField>

      <FormField label="읍 / 면 / 동">
        <input
          type="text"
          value={state.eupMyeonDong}
          onChange={(e) => onFieldChange("eupMyeonDong", e.target.value)}
          placeholder="예: 서교동"
          aria-label="읍/면/동"
          className={fieldInputClass}
        />
      </FormField>

      <FormField label="우편번호">
        <input
          type="text"
          value={state.postalCode}
          onChange={(e) => onFieldChange("postalCode", e.target.value)}
          placeholder="예: 04039"
          aria-label="우편번호"
          className={fieldInputClass}
        />
      </FormField>

      <FormField label="도로명 주소" full hint="지번 대신 도로명 주소로 입력해 주세요.">
        <input
          type="text"
          value={state.roadAddress}
          onChange={(e) => onFieldChange("roadAddress", e.target.value)}
          placeholder="예: 와우산로 12길 3"
          aria-label="도로명 주소"
          className={fieldInputClass}
        />
      </FormField>

      <FormField
        label="상세 주소"
        full
        hint="건물명, 층, 호수 등 구체적인 위치를 적어 주세요."
      >
        <input
          type="text"
          value={state.addressDetail}
          onChange={(e) => onFieldChange("addressDetail", e.target.value)}
          placeholder="예: 2층"
          aria-label="상세 주소"
          className={fieldInputClass}
        />
      </FormField>
    </div>
  );
}

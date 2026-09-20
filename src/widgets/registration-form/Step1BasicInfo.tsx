import type { SpaceCategory } from "@/entities/space-category";
import { FormField, fieldInputClass } from "./FormField";
import { CategoryPicker } from "./CategoryPicker";
import type { RegistrationFormState } from "./model";

export interface Step1BasicInfoProps {
  state: RegistrationFormState;
  onFieldChange: <K extends keyof RegistrationFormState>(
    key: K,
    value: RegistrationFormState[K],
  ) => void;
}

/** Step 1 — 기본 정보. Fields lifted 1:1 from design-reference.html `#p-new`. */
export function Step1BasicInfo({ state, onFieldChange }: Step1BasicInfoProps) {
  return (
    <div className="grid grid-cols-1 gap-4.5 sm:grid-cols-2">
      <FormField label="공간 이름" full>
        <input
          type="text"
          value={state.name}
          onChange={(e) => onFieldChange("name", e.target.value)}
          placeholder="예: 주말의 작은 향수 가게"
          aria-label="공간 이름"
          className={fieldInputClass}
        />
      </FormField>

      <FormField label="카테고리" full hint="선택한 색이 목록과 카드에 그대로 쓰입니다.">
        <CategoryPicker
          value={state.category}
          onChange={(category: SpaceCategory) => onFieldChange("category", category)}
        />
      </FormField>

      <FormField label="면적 (㎡)">
        <input
          type="number"
          min={0}
          value={state.area}
          onChange={(e) => onFieldChange("area", e.target.value)}
          aria-label="면적"
          className={fieldInputClass}
        />
      </FormField>

      <FormField label="최대 수용 인원">
        <input
          type="number"
          min={0}
          value={state.capacity}
          onChange={(e) => onFieldChange("capacity", e.target.value)}
          aria-label="수용 인원"
          className={fieldInputClass}
        />
      </FormField>

      <FormField
        label="공간 소개"
        full
        hint="사진이 없을수록 설명이 중요합니다. 크기·채광·층수·접근성을 적어 주세요."
      >
        <textarea
          value={state.description}
          onChange={(e) => onFieldChange("description", e.target.value)}
          aria-label="공간 소개"
          className={`${fieldInputClass} min-h-[104px] resize-y leading-[1.7]`}
        />
      </FormField>

      <FormField
        label="대표 사진 (선택)"
        full
        hint="사진 없이도 등록됩니다. 지금 올려두고 싶다면 jpeg/png/webp 파일 하나를 선택해 주세요."
      >
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => onFieldChange("thumbnailFile", e.target.files?.[0] ?? null)}
          aria-label="대표 사진"
          className={`${fieldInputClass} py-2.5`}
        />
        {state.thumbnailFile && (
          <span className="text-[0.79rem] text-soft">선택됨: {state.thumbnailFile.name}</span>
        )}
      </FormField>
    </div>
  );
}

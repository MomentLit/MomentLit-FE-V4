import type { SpaceCategory } from "@/entities/space-category";
import { useState } from "react";
import { MAX_SPACE_PHOTOS, SPACE_HERO_ASPECT } from "@/entities/space";
import { MultiPhotoUpload } from "@/shared/ui/MultiPhotoUpload";
import { PanoramaPhotoField } from "@/widgets/panorama/ui/PanoramaPhotoField";
import { FormField, fieldInputClass } from "./FormField";
import { CategoryPicker } from "./CategoryPicker";
import { OptionTabs, type OptionStepProps } from "./OptionTabs";
import type { RegistrationFormState } from "./model";

export interface Step1BasicInfoProps extends OptionStepProps {
  state: RegistrationFormState;
  onFieldChange: <K extends keyof RegistrationFormState>(
    key: K,
    value: RegistrationFormState[K],
  ) => void;
}

/** Step 1 — 기본 정보. Fields lifted 1:1 from design-reference.html `#p-new`. */
export function Step1BasicInfo({ state, onFieldChange, optionTabs, onOptionChange }: Step1BasicInfoProps) {
  const [photoOverflow, setPhotoOverflow] = useState(false);
  const option = optionTabs.options[optionTabs.activeIndex];
  const multiple = optionTabs.options.length > 1;

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

      <FormField label="카테고리" full hint="대표 사진이 없으면 카테고리 색상이 카드 배경으로 표시됩니다.">
        <CategoryPicker
          value={state.category}
          onChange={(category: SpaceCategory) => onFieldChange("category", category)}
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

      <OptionTabs {...optionTabs}>
        <FormField label="면적 (㎡)">
          <input
            type="number"
            min={0}
            value={option.area}
            onChange={(e) => onOptionChange("area", e.target.value)}
            aria-label="면적"
            className={fieldInputClass}
          />
        </FormField>

        <FormField label="최대 수용 인원">
          <input
            type="number"
            min={0}
            value={option.capacity}
            onChange={(e) => onOptionChange("capacity", e.target.value)}
            aria-label="수용 인원"
            className={fieldInputClass}
          />
        </FormField>

        <FormField
          label={multiple ? "구역 사진 (선택)" : "공간 사진 (선택)"}
          full
          hint={
            photoOverflow
              ? `사진은 최대 ${MAX_SPACE_PHOTOS}장까지 올릴 수 있어요. 넘친 사진은 빠졌어요.`
              : "사진 없이도 등록됩니다. 여러 장을 한 번에 선택할 수 있어요."
          }
        >
          <MultiPhotoUpload
            key={option.id}
            items={option.photos}
            max={MAX_SPACE_PHOTOS}
            cropAspect={SPACE_HERO_ASPECT}
            onChange={(photos) => {
              setPhotoOverflow(false);
              onOptionChange("photos", photos);
            }}
            onOverflow={() => setPhotoOverflow(true)}
          />
        </FormField>
        <PanoramaPhotoField
          key={option.id}
          value={option.panoramaUrl}
          onChange={(url) => onOptionChange("panoramaUrl", url)}
          title={[state.name.trim() || "새 공간", multiple ? option.label.trim() : ""].filter(Boolean).join(" · ")}
        />
      </OptionTabs>
    </div>
  );
}

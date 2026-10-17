"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IconArrowRight } from "@tabler/icons-react";
import { cn } from "@/shared/lib";
// entities/space/index.ts only re-exports types, not the api functions — imported
// directly from the api module instead (entities files are read-only in this scope).
import { createSpace, updateAvailability } from "@/entities/space/api";
import { uploadImage } from "@/shared/api/upload";
import { resolvePhotoUrls, useRevokePhotoItemsOnUnmount } from "@/shared/ui/MultiPhotoUpload";
import { getErrorMessage } from "@/shared/api/error";
import { useRequireAuth } from "@/widgets/auth";
import { Stepper } from "./Stepper";
import { Step1BasicInfo } from "./Step1BasicInfo";
import { Step2Location, type SelectedAddress } from "./Step2Location";
import { Step3Terms } from "./Step3Terms";
import { Step4Schedule } from "./Step4Schedule";
import type { OptionStepProps } from "./OptionTabs";
import {
  TOTAL_STEPS,
  createInitialFormState,
  createOptionState,
  optionDisplayLabel,
  toAvailabilitySlots,
  toSpaceCreateRequest,
  usesWeeklySchedule,
  validateRegistrationForm,
  validateStep,
  type RegistrationFormState,
  type SpaceOptionState,
  type ValidationError,
} from "./model";

const primaryButtonClass = "button button--primary";
const outlineButtonClass = "button button--outline";

/**
 * 4-step space registration wizard — orchestrates client-only form state,
 * step navigation, and the final submission to the real backend. Port of
 * design-reference.html's `#p-new` section (see ANALYSIS.md §2.6). Requires
 * auth (gated via `useRequireAuth`): the whole screen is host-only.
 */
export function RegistrationForm() {
  const { ready } = useRequireAuth();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [state, setState] = useState<RegistrationFormState>(createInitialFormState);
  useRevokePhotoItemsOnUnmount(state.options.flatMap((option) => option.photos));
  const [activeOptionIndex, setActiveOptionIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  /**
   * 구역마다 Space를 하나씩 만들기 때문에 중간 구역에서 실패할 수 있다 — 이미 만든
   * 구역(option id → space id)과 운영 시간까지 저장한 구역을 기억해서, 다시 누르면
   * 남은 구역만 이어서 만든다(같은 구역이 두 번 등록되지 않게).
   */
  const createdSpaceIdsRef = useRef(new Map<string, number>());
  const savedScheduleRef = useRef(new Set<string>());

  function onFieldChange<K extends keyof RegistrationFormState>(
    key: K,
    value: RegistrationFormState[K],
  ) {
    setState((prev) => ({ ...prev, [key]: value }));
    setSubmitError(null);
  }

  const activeIndex = Math.min(activeOptionIndex, state.options.length - 1);

  function onOptionChange<K extends keyof SpaceOptionState>(key: K, value: SpaceOptionState[K]) {
    setState((prev) => ({
      ...prev,
      options: prev.options.map((option, index) => (index === activeIndex ? { ...option, [key]: value } : option)),
    }));
    setSubmitError(null);
  }

  function addOption() {
    setState((prev) => ({ ...prev, options: [...prev.options, createOptionState(prev.options[activeIndex])] }));
    setActiveOptionIndex(state.options.length);
    setSubmitError(null);
  }

  function removeOption(index: number) {
    const removed = state.options[index];
    if (!removed || state.options.length < 2) return;
    if (createdSpaceIdsRef.current.has(removed.id)) {
      setSubmitError("이미 등록된 구역이라 여기서는 삭제할 수 없어요. 등록을 마친 뒤 내 공간에서 삭제해 주세요.");
      return;
    }
    removed.photos.forEach((photo) => {
      if (photo.file && photo.url.startsWith("blob:")) URL.revokeObjectURL(photo.url);
    });
    setState((prev) => ({ ...prev, options: prev.options.filter((_, i) => i !== index) }));
    setActiveOptionIndex((prev) => Math.max(0, prev >= index ? prev - 1 : prev));
    setSubmitError(null);
  }

  const optionTabs: OptionStepProps["optionTabs"] = {
    options: state.options,
    activeIndex,
    onSelect: setActiveOptionIndex,
    onAdd: addOption,
    onRemove: removeOption,
    onLabelChange: (label) => onOptionChange("label", label),
  };

  function showValidationError(error: ValidationError) {
    setSubmitError(error.message);
    if (error.optionIndex !== undefined) setActiveOptionIndex(error.optionIndex);
  }

  const onAddressSelect = useCallback((address: SelectedAddress) => {
    setState((previous) => ({ ...previous, ...address }));
    setSubmitError(null);
  }, []);

  function goToStep(next: number) {
    // Mirrors the Stepper's own `reachable` guard so a stray call here can
    // never skip ahead to a step the user hasn't reached yet.
    if (next <= step) setStep(next);
    setSubmitError(null);
  }

  function handleNext() {
    const stepError = validateStep(step, state);
    if (stepError) {
      showValidationError(stepError);
      return;
    }
    setStep((prev) => Math.min(TOTAL_STEPS, prev + 1));
    setSubmitError(null);
  }

  function handleBack() {
    setStep((prev) => Math.max(1, prev - 1));
    setSubmitError(null);
  }

  /**
   * Shared submission path for both "등록하기" and "임시 저장" — only
   * `is_draft` differs. 구역마다 순서대로 사진을 올리고(첫 장이 대표 사진) Space를
   * 만든 뒤 주간 운영 시간을 저장하고, 끝나면 첫 구역의 상세 페이지로 이동한다.
   */
  async function submit(isDraft: boolean) {
    const validationError = validateRegistrationForm(state);
    if (validationError) {
      showValidationError(validationError);
      setStep((prev) => Math.min(prev, validationError.step));
      return;
    }

    setSubmitError(null);
    setSubmitting(true);
    const created = createdSpaceIdsRef.current;
    const savedSchedule = savedScheduleRef.current;
    let currentIndex = 0;
    try {
      for (const [index, option] of state.options.entries()) {
        currentIndex = index;
        let spaceId = created.get(option.id);
        if (spaceId === undefined) {
          const imageUrls = await resolvePhotoUrls(option.photos, (file) => uploadImage(file));
          ({ space_id: spaceId } = await createSpace(toSpaceCreateRequest(state, option, { imageUrls, isDraft })));
          created.set(option.id, spaceId);
        }
        if (usesWeeklySchedule(state) && !savedSchedule.has(option.id)) {
          await updateAvailability(spaceId, toAvailabilitySlots(option.weeklySchedule));
          savedSchedule.add(option.id);
        }
      }

      router.push(`/spaces/${created.get(state.options[0].id)}`);
    } catch (error) {
      const message = getErrorMessage(error);
      if (state.options.length > 1) {
        const label = optionDisplayLabel(state.options[currentIndex], currentIndex);
        setSubmitError(`[${label}] ${message}${created.size > 0 ? " 앞서 등록된 구역은 저장됐어요. 다시 누르면 남은 구역만 이어서 등록해요." : ""}`);
        setActiveOptionIndex(currentIndex);
      } else {
        setSubmitError(message);
      }
      setSubmitting(false);
    }
  }

  function handleSaveDraft() {
    void submit(true);
  }

  function handleSubmit() {
    void submit(false);
  }

  const isLastStep = step === TOTAL_STEPS;

  if (!ready) {
    return <div className="flex-1 p-10 text-sm text-soft">로그인이 필요한 서비스입니다.</div>;
  }

  return (
    <div className="page-shell flex flex-col gap-7">
      <div>
        <h1 className="page-title text-ink">
          공간 등록
        </h1>
        <p className="mt-2 text-[0.92rem] text-soft">
          사진 없이도 등록됩니다. 나중에 언제든 추가할 수 있습니다.
        </p>
      </div>

      <Stepper current={step} onSelect={goToStep} />

      <div className="max-w-[900px]">
        {step === 1 && <Step1BasicInfo state={state} onFieldChange={onFieldChange} optionTabs={optionTabs} onOptionChange={onOptionChange} />}
        {step === 2 && <Step2Location state={state} onFieldChange={onFieldChange} onAddressSelect={onAddressSelect} />}
        {step === 3 && <Step3Terms state={state} onFieldChange={onFieldChange} optionTabs={optionTabs} onOptionChange={onOptionChange} />}
        {step === 4 && <Step4Schedule state={state} onFieldChange={onFieldChange} optionTabs={optionTabs} onOptionChange={onOptionChange} />}
      </div>

      {submitError && (
        <p className="max-w-[900px] shadow-[inset_3px_0_0_var(--coral)] bg-wash px-4.5 py-3 text-[0.88rem] text-coral">
          {submitError}
        </p>
      )}

      <div className="flex max-w-[900px] flex-wrap gap-2">
        {step > 1 && (
          <button
            type="button"
            onClick={handleBack}
            disabled={submitting}
            className={cn(outlineButtonClass, "disabled:opacity-60")}
          >
            이전
          </button>
        )}
        <button
          type="button"
          onClick={isLastStep ? handleSubmit : handleNext}
          disabled={submitting}
          className={cn(primaryButtonClass, "disabled:opacity-60")}
        >
          {isLastStep ? (submitting ? "등록 중…" : "등록하기") : "다음 단계"}
          <IconArrowRight size={16} stroke={2} aria-hidden />
        </button>
        <button
          type="button"
          onClick={handleSaveDraft}
          disabled={submitting}
          className={cn(outlineButtonClass, "disabled:opacity-60")}
        >
          {submitting ? "저장 중…" : "임시 저장"}
        </button>
      </div>
    </div>
  );
}

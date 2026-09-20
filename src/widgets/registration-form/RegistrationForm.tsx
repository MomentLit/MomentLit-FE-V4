"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconArrowRight } from "@tabler/icons-react";
import { cn } from "@/shared/lib";
// entities/space/index.ts only re-exports types, not the api functions — imported
// directly from the api module instead (entities files are read-only in this scope).
import { createSpace, updateAvailability } from "@/entities/space/api";
import { uploadImage } from "@/shared/api/upload";
import { getErrorMessage } from "@/shared/api/error";
import { useRequireAuth } from "@/widgets/auth";
import { Stepper } from "./Stepper";
import { Step1BasicInfo } from "./Step1BasicInfo";
import { Step2Location } from "./Step2Location";
import { Step3Terms } from "./Step3Terms";
import { Step4Schedule } from "./Step4Schedule";
import {
  TOTAL_STEPS,
  createInitialFormState,
  toAvailabilitySlots,
  toSpaceCreateRequest,
  validateRegistrationForm,
  validateStep,
  type RegistrationFormState,
} from "./model";

const buttonBase =
  "inline-flex items-center justify-center gap-2 px-6 py-4 text-[0.94rem] font-bold transition-colors";

/** Port of design-reference.html's `.btn.btn-l.btn-main`. */
const primaryButtonClass = cn(buttonBase, "bg-sky text-ink hover:bg-main-d hover:text-white");
/** Port of `.btn.btn-l.btn-ol`. */
const outlineButtonClass = cn(
  buttonBase,
  "text-ink shadow-[inset_0_0_0_1.5px_var(--line-2)] hover:bg-ink hover:text-white hover:shadow-[inset_0_0_0_1.5px_var(--ink)]",
);

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
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function onFieldChange<K extends keyof RegistrationFormState>(
    key: K,
    value: RegistrationFormState[K],
  ) {
    setState((prev) => ({ ...prev, [key]: value }));
    setSubmitError(null);
  }

  function goToStep(next: number) {
    // Mirrors the Stepper's own `reachable` guard so a stray call here can
    // never skip ahead to a step the user hasn't reached yet.
    if (next <= step) setStep(next);
    setSubmitError(null);
  }

  function handleNext() {
    const stepError = validateStep(step, state);
    if (stepError) {
      setSubmitError(stepError);
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
   * `is_draft` differs. Creates the space, uploads+attaches the thumbnail
   * when one was picked, writes the weekly availability template, then
   * routes to the new space's detail page.
   */
  async function submit(isDraft: boolean) {
    const validationError = validateRegistrationForm(state);
    if (validationError) {
      setSubmitError(validationError);
      return;
    }

    setSubmitError(null);
    setSubmitting(true);
    try {
      let thumbnailUrl: string | undefined;
      if (state.thumbnailFile) {
        thumbnailUrl = await uploadImage(state.thumbnailFile);
      }

      const { space_id } = await createSpace(
        toSpaceCreateRequest(state, { thumbnailUrl, isDraft }),
      );
      await updateAvailability(space_id, toAvailabilitySlots(state.weeklySchedule));

      router.push(`/spaces/${space_id}`);
    } catch (error) {
      setSubmitError(getErrorMessage(error));
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
    <div className="flex flex-col gap-7 p-[clamp(22px,3vw,40px)]">
      <div>
        <h1 className="text-[clamp(1.5rem,3vw,2.2rem)] font-semibold tracking-tight text-ink">
          공간 등록
        </h1>
        <p className="mt-2 text-[0.92rem] text-soft">
          사진 없이도 등록됩니다. 나중에 언제든 추가할 수 있습니다.
        </p>
      </div>

      <Stepper current={step} onSelect={goToStep} />

      <div className="max-w-[900px]">
        {step === 1 && <Step1BasicInfo state={state} onFieldChange={onFieldChange} />}
        {step === 2 && <Step2Location state={state} onFieldChange={onFieldChange} />}
        {step === 3 && <Step3Terms state={state} onFieldChange={onFieldChange} />}
        {step === 4 && <Step4Schedule state={state} onFieldChange={onFieldChange} />}
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

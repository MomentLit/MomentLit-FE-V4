"use client";

import { IconCamera, IconCircleCheck } from "@tabler/icons-react";
import { cn } from "@/shared/lib";
import {
  PANORAMA_CAPTURE_DETAILED_GUIDE,
  PANORAMA_CAPTURE_STEPS,
  PANORAMA_CAPTURE_TIPS,
} from "../model";

export interface PanoramaCaptureGuideProps {
  /** `PANORAMA_CAPTURE_STEPS`와 같은 길이·순서. 아직 안 찍은 칸은 null. */
  files: (File | null)[];
  onCapture: (index: number) => void;
  mobile: boolean;
  disabled?: boolean;
}

/** "360도 사진 찍기" — 촬영 가이드와 방향별 사진 칸. */
export function PanoramaCaptureGuide({ files, onCapture, mobile, disabled }: PanoramaCaptureGuideProps) {
  const filledCount = files.filter(Boolean).length;
  const nextIndex = files.findIndex((file) => file === null);

  return (
    <div className="flex flex-col gap-5">
      {mobile ? (
        <ul className="flex flex-col gap-1.5 bg-wash px-4.5 py-3.5">
          {PANORAMA_CAPTURE_TIPS.map((tip) => (
            <li key={tip} className="text-[0.84rem] leading-[1.6] text-ink">
              · {tip}
            </li>
          ))}
        </ul>
      ) : (
        <div className="grid grid-cols-1 gap-4 bg-wash px-5 py-4.5 sm:grid-cols-2">
          {PANORAMA_CAPTURE_DETAILED_GUIDE.map((section) => (
            <section key={section.title} className="flex flex-col gap-1.5">
              <h3 className="text-sm font-bold text-ink">{section.title}</h3>
              <ul className="flex flex-col gap-1">
                {section.items.map((item) => (
                  <li key={item} className="text-[0.82rem] leading-[1.6] text-soft">
                    · {item}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {/* 모바일: 다음에 찍을 칸을 크게 띄운다. 브라우저 정책상 카메라는 사용자가 눌러야만 켜진다. */}
      {mobile && nextIndex !== -1 && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onCapture(nextIndex)}
          className={cn(
            "flex cursor-pointer items-center gap-4 border-2 border-sky bg-wash px-4 py-4 focus-within:border-main-d",
            disabled && "pointer-events-none opacity-60",
          )}
        >
          <IconCamera size={28} stroke={1.8} className="shrink-0 text-main-d" aria-hidden />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[0.75rem] font-bold text-main-d">
              다음 촬영 · {PANORAMA_CAPTURE_STEPS[nextIndex].label}번
            </span>
            <span className="text-lg font-bold text-ink">{PANORAMA_CAPTURE_STEPS[nextIndex].direction}</span>
            <span className="text-[0.79rem] text-soft">{PANORAMA_CAPTURE_STEPS[nextIndex].hint}</span>
          </span>
          <span className="button button--primary shrink-0">촬영</span>
        </button>
      )}
      {mobile && nextIndex === -1 && (
        <p className="flex items-center gap-2 bg-wash px-4.5 py-3.5 text-[0.88rem] text-ink">
          <IconCircleCheck size={18} stroke={2} className="shrink-0 text-main-d" aria-hidden />
          {PANORAMA_CAPTURE_STEPS.length}장을 모두 찍었어요. 다음 단계에서 사진을 검수해 주세요.
        </p>
      )}

      <div className="flex items-baseline justify-between">
        <span className="text-lg font-bold text-ink">
          촬영 순서
        </span>
        <span className="text-[0.79rem] text-soft">
          {filledCount} / {PANORAMA_CAPTURE_STEPS.length}장
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {PANORAMA_CAPTURE_STEPS.map((step, index) => {
          const file = files[index];
          return (
            <button
              type="button"
              disabled={disabled}
              onClick={() => onCapture(index)}
              key={step.label}
              className={cn(
                "flex cursor-pointer items-start gap-3 border px-4 py-3.5 transition-colors focus-within:border-sky",
                file
                  ? "border-sky bg-wash"
                  : "border-line hover:border-ink",
                disabled && "pointer-events-none opacity-60",
              )}
            >
              <span className="font-mono text-[0.72rem] font-medium text-soft">{step.label}</span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-base font-bold text-ink">{step.direction}</span>
                <span className="text-[0.79rem] text-soft">{step.hint}</span>
                {file && (
                  <span className="truncate text-[0.79rem] text-main-d">
                    촬영 완료 · 다시 찍으려면 누르세요
                  </span>
                )}
              </span>
              <IconCamera size={18} stroke={1.8} className="mt-0.5 shrink-0 text-soft" aria-hidden />
            </button>
          );
        })}
      </div>
    </div>
  );
}

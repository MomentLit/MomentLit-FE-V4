"use client";

import { IconCamera } from "@tabler/icons-react";
import { cn } from "@/shared/lib";
import { CAPTURE_ACCEPT, PANORAMA_CAPTURE_STEPS, PANORAMA_CAPTURE_TIPS } from "../model";

export interface PanoramaCaptureGuideProps {
  /** `PANORAMA_CAPTURE_STEPS`와 같은 길이·순서. 아직 안 고른 칸은 null. */
  files: (File | null)[];
  onFileChange: (index: number, file: File) => void;
  disabled?: boolean;
}

/**
 * "360도 사진 찍기" — 촬영 요령과 방향별 사진 칸. 사용자는 가이드대로 휴대폰 카메라로 찍은 사진을
 * 칸마다 하나씩 고른다(모바일 브라우저는 파일 선택 시 카메라/앨범 중 고를 수 있다).
 */
export function PanoramaCaptureGuide({ files, onFileChange, disabled }: PanoramaCaptureGuideProps) {
  const filledCount = files.filter(Boolean).length;

  return (
    <div className="flex flex-col gap-5">
      <ul className="flex flex-col gap-1.5 bg-wash px-4.5 py-3.5">
        {PANORAMA_CAPTURE_TIPS.map((tip) => (
          <li key={tip} className="text-[0.84rem] leading-[1.6] text-ink">
            · {tip}
          </li>
        ))}
      </ul>

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
            <label
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
                {file && <span className="truncate text-[0.79rem] text-main-d">선택됨: {file.name}</span>}
              </span>
              <IconCamera size={18} stroke={1.8} className="mt-0.5 shrink-0 text-soft" aria-hidden />
              <input
                type="file"
                accept={CAPTURE_ACCEPT}
                disabled={disabled}
                onChange={(e) => {
                  // 선택 창을 그냥 닫으면 files가 비어 오는데, 그때 이미 고른 사진을 지우지 않는다.
                  const next = e.target.files?.[0];
                  if (next) onFileChange(index, next);
                }}
                aria-label={`${step.direction} 사진`}
                className="sr-only"
              />
            </label>
          );
        })}
      </div>
    </div>
  );
}

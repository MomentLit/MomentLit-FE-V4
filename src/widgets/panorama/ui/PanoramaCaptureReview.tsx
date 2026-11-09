"use client";

import { useEffect, useState } from "react";
import { IconAlertTriangle, IconCircleCheck, IconRefresh } from "@tabler/icons-react";
import { cn } from "@/shared/lib";
import {
  CAPTURE_ACCEPT,
  PANORAMA_CAPTURE_STEPS,
  readCapturePhotoSize,
  reviewCapturePhotos,
  type CapturePhotoSize,
} from "../model";

export interface PanoramaCaptureReviewProps {
  /** 10장이 모두 채워진 상태로만 들어온다(`PANORAMA_CAPTURE_STEPS`와 같은 순서). */
  files: readonly File[];
  onFileChange: (index: number, file: File) => void;
  /** 모바일이면 "사진 바꾸기"가 앨범 대신 카메라를 바로 연다. */
  mobile: boolean;
  disabled?: boolean;
}

/**
 * 합성 전 검수 — 10장을 방향과 함께 한눈에 보여주고, 중복·세로 촬영·낮은 해상도를 경고한다.
 * 경고는 안내일 뿐이라 그대로 합성할 수 있다.
 */
export function PanoramaCaptureReview({ files, onFileChange, mobile, disabled }: PanoramaCaptureReviewProps) {
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [sizes, setSizes] = useState<(CapturePhotoSize | null)[] | null>(null);

  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    queueMicrotask(() => setPreviewUrls(urls));
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => setSizes(null));

    Promise.all(files.map((file) => readCapturePhotoSize(file).catch(() => null))).then((result) => {
      if (!cancelled) setSizes(result);
    });

    return () => {
      cancelled = true;
    };
  }, [files]);

  const warnings = sizes ? reviewCapturePhotos(files, sizes) : null;
  const warningCount = warnings ? warnings.filter((list) => list.length > 0).length : 0;

  return (
    <div className="flex flex-col gap-5">
      {!warnings ? (
        <p className="bg-wash px-4.5 py-3.5 text-[0.88rem] text-soft">사진을 확인하는 중…</p>
      ) : warningCount === 0 ? (
        <p className="flex items-center gap-2 bg-wash px-4.5 py-3.5 text-[0.88rem] text-ink">
          <IconCircleCheck size={18} stroke={2} className="shrink-0 text-main-d" aria-hidden />
          문제가 발견되지 않았어요. 순서와 방향이 맞는지 한 번 더 확인한 뒤 합성해 주세요.
        </p>
      ) : (
        <p className="flex items-start gap-2 border-l-4 border-coral bg-wash px-4.5 py-3.5 text-[0.88rem] text-ink">
          <IconAlertTriangle size={18} stroke={2} className="mt-0.5 shrink-0 text-coral" aria-hidden />
          확인이 필요한 사진이 {warningCount}장 있어요. 그대로 합성할 수도 있지만, 결과가 어색하거나 합성이 실패할 수 있어요.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {PANORAMA_CAPTURE_STEPS.map((step, index) => {
          const photoWarnings = warnings?.[index] ?? [];
          return (
            <div
              key={step.label}
              className={cn(
                "flex min-w-0 flex-col gap-1.5 border p-2",
                photoWarnings.length > 0 ? "border-coral" : "border-line",
              )}
            >
              <div className="aspect-[4/3] overflow-hidden bg-wash">
                {previewUrls[index] && (
                  // eslint-disable-next-line @next/next/no-img-element -- 업로드 전 로컬 blob 미리보기
                  <img src={previewUrls[index]} alt={`${step.direction} 사진`} className="h-full w-full object-cover" />
                )}
              </div>
              <span className="flex items-baseline gap-1.5">
                <span className="font-mono text-[0.72rem] font-medium text-soft">{step.label}</span>
                <span className="truncate text-sm font-bold text-ink">{step.direction}</span>
              </span>
              {photoWarnings.map((warning) => (
                <span key={warning} className="text-[0.75rem] leading-[1.5] text-coral">
                  {warning}
                </span>
              ))}
              {/* .button과 같은 모양의 작은 버전 — 5열 칸이 좁아 기본 .button 여백으로는 넘친다. */}
              <label
                className={cn(
                  "mt-auto inline-flex min-h-9 cursor-pointer items-center justify-center gap-1 border border-line-2 bg-white px-2 text-xs font-bold text-ink transition-colors hover:border-ink hover:bg-ink hover:text-white focus-within:border-sky",
                  disabled && "pointer-events-none opacity-60",
                )}
              >
                <IconRefresh size={14} stroke={2} aria-hidden />
                사진 바꾸기
                <input
                  type="file"
                  accept={CAPTURE_ACCEPT}
                  capture={mobile ? "environment" : undefined}
                  disabled={disabled}
                  onChange={(e) => {
                    const next = e.target.files?.[0];
                    if (next) onFileChange(index, next);
                  }}
                  aria-label={`${step.direction} 사진 바꾸기`}
                  className="sr-only"
                />
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
}

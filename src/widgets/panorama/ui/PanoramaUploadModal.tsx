"use client";

import { useEffect, useState } from "react";
import { IconArrowLeft, IconCamera, IconRefresh, IconUpload, IconX } from "@tabler/icons-react";
import { cn } from "@/shared/lib";
import { stitchPanorama, uploadPanorama } from "@/shared/api/upload";
import { getErrorMessage } from "@/shared/api/error";
import { fieldInputClass } from "@/widgets/registration-form/FormField";
import {
  PANORAMA_ACCEPT,
  PANORAMA_CAPTURE_STEPS,
  downscaleForStitch,
  isPanoramaRatio,
  readImageRatio,
} from "../model";
import { PanoramaCaptureGuide } from "./PanoramaCaptureGuide";
import { PanoramaViewer } from "./PanoramaViewerModal";

type Mode = "CHOOSE" | "UPLOAD" | "CAPTURE" | "PREVIEW";

const buttonBase =
  "inline-flex items-center justify-center gap-2 px-5 py-3 text-[0.88rem] font-bold transition-colors disabled:opacity-60";

/** Same as RegistrationForm's `.btn-main` / `.btn-ol` ports. */
const primaryButtonClass = cn(buttonBase, "bg-sky text-ink hover:bg-main-d hover:text-white");
const outlineButtonClass = cn(
  buttonBase,
  "text-ink shadow-[inset_0_0_0_1.5px_var(--line-2)] hover:bg-ink hover:text-white hover:shadow-[inset_0_0_0_1.5px_var(--ink)]",
);

const MODE_TITLES: Record<Mode, string> = {
  CHOOSE: "360° 사진 추가",
  UPLOAD: "360° 사진 넣기",
  CAPTURE: "360° 사진 찍기",
  PREVIEW: "AI 합성 결과",
};

function createEmptySlots(): (File | null)[] {
  return PANORAMA_CAPTURE_STEPS.map(() => null);
}

export interface PanoramaUploadModalProps {
  onClose: () => void;
  /** 업로드(또는 AI 합성)가 끝나 S3에 올라간 360도 사진 URL. */
  onConfirm: (panoramaUrl: string) => void;
}

/**
 * 공간 등록/수정 화면의 360도 사진 모달.
 *  - 넣기: 이미 만들어진 2:1 사진 한 장 → 브라우저에서 비율 확인 → 미리보기 → 업로드
 *  - 찍기: 촬영 가이드대로 찍은 10장 → AI 합성 → 미리보기(다시 합성 가능) → 확정
 * 모달 형태는 `AuthModal`과 같다.
 */
export function PanoramaUploadModal({ onClose, onConfirm }: PanoramaUploadModalProps) {
  const [mode, setMode] = useState<Mode>("CHOOSE");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 넣기
  const [panoramaFile, setPanoramaFile] = useState<File | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);

  // 찍기
  const [captureFiles, setCaptureFiles] = useState<(File | null)[]>(createEmptySlots);
  const [stitchedUrl, setStitchedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!localPreviewUrl) return;
    return () => URL.revokeObjectURL(localPreviewUrl);
  }, [localPreviewUrl]);

  function goTo(next: Mode) {
    setMode(next);
    setError(null);
  }

  async function handlePanoramaFileChange(file: File | undefined) {
    setError(null);
    setPanoramaFile(null);
    setLocalPreviewUrl(null);
    if (!file) return;

    try {
      const ratio = await readImageRatio(file);
      if (!isPanoramaRatio(ratio)) {
        setError("360° 사진은 가로:세로 비율이 2:1이어야 해요.");
        return;
      }
    } catch (ratioError) {
      setError(getErrorMessage(ratioError));
      return;
    }

    setPanoramaFile(file);
    setLocalPreviewUrl(URL.createObjectURL(file));
  }

  async function handleUploadConfirm() {
    if (!panoramaFile) return;
    setError(null);
    setBusy(true);
    try {
      const url = await uploadPanorama(panoramaFile);
      onConfirm(url);
    } catch (uploadError) {
      setError(getErrorMessage(uploadError));
      setBusy(false);
    }
  }

  function handleCaptureFileChange(index: number, file: File) {
    setCaptureFiles((prev) => prev.map((current, i) => (i === index ? file : current)));
    setError(null);
  }

  async function handleStitch() {
    const files = captureFiles.filter((file): file is File => file !== null);
    if (files.length !== PANORAMA_CAPTURE_STEPS.length) {
      setError(`가이드의 ${PANORAMA_CAPTURE_STEPS.length}장을 모두 골라 주세요.`);
      return;
    }

    setError(null);
    setBusy(true);
    try {
      const url = await stitchPanorama(await Promise.all(files.map(downscaleForStitch)));
      setStitchedUrl(url);
      setMode("PREVIEW");
    } catch (stitchError) {
      setError(getErrorMessage(stitchError));
    } finally {
      setBusy(false);
    }
  }

  const allCaptured = captureFiles.every(Boolean);

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-ink/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={MODE_TITLES[mode]}
      onClick={busy ? undefined : onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-[760px] flex-col gap-6 overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-[0px_8px_24px_0px_rgba(53,65,80,0.12)] sm:p-8"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="font-mono text-[0.66rem] font-medium uppercase tracking-[0.18em] text-soft">
              360° Photo
            </span>
            <h2 className="mt-1 text-[1.3rem] font-semibold tracking-tight text-ink">{MODE_TITLES[mode]}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="닫기"
            className="p-1.5 text-soft transition-colors hover:text-ink disabled:opacity-60"
          >
            <IconX size={20} stroke={2} aria-hidden />
          </button>
        </div>

        {mode === "CHOOSE" && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => goTo("UPLOAD")}
              className="flex flex-col items-start gap-3 rounded-2xl border border-line p-5 text-left transition-colors hover:border-sky hover:bg-wash"
            >
              <IconUpload size={22} stroke={1.8} className="text-main-d" aria-hidden />
              <span className="text-[1rem] font-semibold text-ink">360° 사진 넣기</span>
              <span className="text-[0.84rem] leading-[1.6] text-soft">
                360° 카메라나 파노라마 앱으로 이미 만든 사진(가로:세로 2:1)을 그대로 올려요.
              </span>
            </button>
            <button
              type="button"
              onClick={() => goTo("CAPTURE")}
              className="flex flex-col items-start gap-3 rounded-2xl border border-line p-5 text-left transition-colors hover:border-sky hover:bg-wash"
            >
              <IconCamera size={22} stroke={1.8} className="text-main-d" aria-hidden />
              <span className="text-[1rem] font-semibold text-ink">360° 사진 찍기</span>
              <span className="text-[0.84rem] leading-[1.6] text-soft">
                가이드에 맞춰 휴대폰으로 {PANORAMA_CAPTURE_STEPS.length}장을 찍어 올리면 AI가 360° 사진으로 합쳐 드려요.
              </span>
            </button>
          </div>
        )}

        {mode === "UPLOAD" && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <input
                type="file"
                accept={PANORAMA_ACCEPT}
                disabled={busy}
                onChange={(e) => void handlePanoramaFileChange(e.target.files?.[0])}
                aria-label="360° 사진"
                className={`${fieldInputClass} py-2.5`}
              />
              <span className="text-[0.79rem] text-soft">jpeg/png, 가로:세로 2:1 비율의 사진 한 장.</span>
            </div>
            {localPreviewUrl && (
              <PanoramaViewer src={localPreviewUrl} className="h-[300px] sm:h-[360px]" />
            )}
          </div>
        )}

        {mode === "CAPTURE" && (
          <PanoramaCaptureGuide files={captureFiles} onFileChange={handleCaptureFileChange} disabled={busy} />
        )}

        {mode === "PREVIEW" && stitchedUrl && (
          <div className="flex flex-col gap-2">
            <PanoramaViewer src={stitchedUrl} className="h-[300px] sm:h-[360px]" />
            <span className="text-[0.79rem] text-soft">
              드래그해서 둘러보세요. 어색하면 다시 합성하거나 사진을 바꿔서 합성할 수 있어요.
            </span>
          </div>
        )}

        {error && (
          <p className="shadow-[inset_3px_0_0_var(--coral)] bg-wash px-4.5 py-3 text-[0.88rem] text-coral">{error}</p>
        )}

        {mode !== "CHOOSE" && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => goTo(mode === "PREVIEW" ? "CAPTURE" : "CHOOSE")}
              disabled={busy}
              className={outlineButtonClass}
            >
              <IconArrowLeft size={16} stroke={2} aria-hidden />
              {mode === "PREVIEW" ? "사진 다시 고르기" : "이전"}
            </button>

            {mode === "UPLOAD" && (
              <button
                type="button"
                onClick={() => void handleUploadConfirm()}
                disabled={busy || !panoramaFile}
                className={primaryButtonClass}
              >
                {busy ? "업로드 중…" : "이 사진 사용"}
              </button>
            )}

            {mode === "CAPTURE" && (
              <button
                type="button"
                onClick={() => void handleStitch()}
                disabled={busy || !allCaptured}
                className={primaryButtonClass}
              >
                {busy ? "AI 합성 중…" : "AI로 360° 사진 만들기"}
              </button>
            )}

            {mode === "PREVIEW" && stitchedUrl && (
              <>
                <button type="button" onClick={() => void handleStitch()} disabled={busy} className={outlineButtonClass}>
                  <IconRefresh size={16} stroke={2} aria-hidden />
                  {busy ? "AI 합성 중…" : "다시 합성"}
                </button>
                <button
                  type="button"
                  onClick={() => onConfirm(stitchedUrl)}
                  disabled={busy}
                  className={primaryButtonClass}
                >
                  이 사진 사용
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

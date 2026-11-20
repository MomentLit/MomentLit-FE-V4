"use client";

import { useState, useSyncExternalStore } from "react";
import { IconArrowLeft, IconArrowRight, IconRefresh, IconX } from "@tabler/icons-react";
import { Modal } from "@/shared/ui/Modal";
import { stitchPanorama } from "@/shared/api/upload";
import { getErrorMessage } from "@/shared/api/error";
import { PANORAMA_CAPTURE_STEPS, downscaleForStitch } from "../model";
import { PanoramaCamera } from "./PanoramaCamera";
import { PanoramaCaptureGuide } from "./PanoramaCaptureGuide";
import { PanoramaCaptureReview } from "./PanoramaCaptureReview";
import { PanoramaViewer } from "./PanoramaViewerModal";

type Mode = "CAPTURE" | "REVIEW" | "PREVIEW";

const primaryButtonClass = "button button--primary";
const outlineButtonClass = "button button--outline";

const MODE_TITLES: Record<Mode, string> = {
  CAPTURE: "360° 사진 찍기",
  REVIEW: "사진 검수",
  PREVIEW: "AI 합성 결과",
};

/** "이전" 버튼이 돌아갈 단계 — 합성 결과에서 돌아가면 사진을 바꿀 수 있는 검수 단계로 간다. */
const PREVIOUS_MODES: Record<Exclude<Mode, "CAPTURE">, Mode> = {
  REVIEW: "CAPTURE",
  PREVIEW: "REVIEW",
};

function createEmptySlots(): (File | null)[] {
  return PANORAMA_CAPTURE_STEPS.map(() => null);
}

export interface PanoramaUploadModalProps {
  onClose: () => void;
  /** 합성이 끝나 S3에 올라간 360도 사진 URL. */
  onConfirm: (panoramaUrl: string) => void;
}

export function PanoramaUploadModal({ onClose, onConfirm }: PanoramaUploadModalProps) {
  const [mode, setMode] = useState<Mode>("CAPTURE");
  const isMobile = useSyncExternalStore(subscribeMobile, getMobileSnapshot, () => false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [captureFiles, setCaptureFiles] = useState<(File | null)[]>(createEmptySlots);
  const [stitchedUrl, setStitchedUrl] = useState<string | null>(null);

  const [cameraIndex, setCameraIndex] = useState<number | null>(null);

  function goTo(next: Mode) {
    setMode(next);
    setError(null);
  }

  function handleCaptureFileChange(index: number, file: File) {
    setCaptureFiles((prev) => prev.map((current, i) => (i === index ? file : current)));
    setError(null);
  }

  async function handleStitch() {
    const files = captureFiles.filter((file): file is File => file !== null);
    if (files.length !== PANORAMA_CAPTURE_STEPS.length) {
      setError(`가이드의 ${PANORAMA_CAPTURE_STEPS.length}장을 모두 촬영해 주세요.`);
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
    <Modal label={MODE_TITLES[mode]} onClose={cameraIndex === null ? onClose : () => setCameraIndex(null)} canClose={!busy}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="font-mono text-[0.66rem] font-medium uppercase tracking-[0.18em] text-soft">
            360° Photo
          </span>
          <h2 className="mt-1 section-title text-ink">{MODE_TITLES[mode]}</h2>
        </div>
        <button
          type="button"
          onClick={cameraIndex === null ? onClose : () => setCameraIndex(null)}
          disabled={busy}
          aria-label="닫기"
          className="button button--outline shrink-0"
        >
          <IconX size={20} stroke={2} aria-hidden />
        </button>
      </div>

      {cameraIndex !== null && (
        <PanoramaCamera
          key={cameraIndex}
          step={PANORAMA_CAPTURE_STEPS[cameraIndex]}
          onCancel={() => setCameraIndex(null)}
          onCapture={(photo) => {
            handleCaptureFileChange(cameraIndex, photo);
            setCameraIndex(null);
          }}
        />
      )}
      {mode === "CAPTURE" && cameraIndex === null && (
        <PanoramaCaptureGuide files={captureFiles} onCapture={setCameraIndex} mobile={isMobile} disabled={busy} />
      )}

      {mode === "REVIEW" && cameraIndex === null && allCaptured && (
        <PanoramaCaptureReview
          files={captureFiles as File[]}
          onCapture={setCameraIndex}
          disabled={busy}
        />
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
        <p role="alert" className="border-l-4 border-coral bg-wash px-4.5 py-3 text-[0.88rem] text-coral">{error}</p>
      )}

      {cameraIndex === null && (
        <div className="flex flex-wrap gap-2">
          {mode !== "CAPTURE" && <button
            type="button"
            onClick={() => goTo(PREVIOUS_MODES[mode])}
            disabled={busy}
            className={outlineButtonClass}
          >
            <IconArrowLeft size={16} stroke={2} aria-hidden />
            {mode === "PREVIEW" ? "사진 검수로 돌아가기" : "이전"}
          </button>}

          {mode === "CAPTURE" && (
            <button
              type="button"
              onClick={() => goTo("REVIEW")}
              disabled={busy || !allCaptured}
              className={primaryButtonClass}
            >
              다음: 사진 검수
              <IconArrowRight size={16} stroke={2} aria-hidden />
            </button>
          )}

          {mode === "REVIEW" && (
            <button
              type="button"
              onClick={() => void handleStitch()}
              disabled={busy || !allCaptured}
              className={primaryButtonClass}
            >
              {busy ? "AI 합성 중…" : "검수 완료 · AI로 360° 사진 만들기"}
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
    </Modal>
  );
}

function getMobileSnapshot() { return window.matchMedia("(max-width: 767px)").matches; }
function subscribeMobile(callback: () => void) {
  const media = window.matchMedia("(max-width: 767px)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

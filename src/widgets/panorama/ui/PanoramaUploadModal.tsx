"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { IconArrowLeft, IconArrowRight, IconCamera, IconRefresh, IconUpload, IconX } from "@tabler/icons-react";
import { Modal } from "@/shared/ui/Modal";
import { stitchPanorama, uploadPanorama } from "@/shared/api/upload";
import { getErrorMessage } from "@/shared/api/error";
import {
  PANORAMA_ACCEPT,
  PANORAMA_CAPTURE_STEPS,
  downscaleForStitch,
  isPanoramaRatio,
  isPhonePanoramaRatio,
  readImageRatio,
} from "../model";
import { PanoramaCaptureGuide } from "./PanoramaCaptureGuide";
import { PanoramaCaptureReview } from "./PanoramaCaptureReview";
import { PanoramaViewer } from "./PanoramaViewerModal";

type Mode = "CHOOSE" | "UPLOAD" | "CAPTURE" | "REVIEW" | "PREVIEW";

const primaryButtonClass = "button button--primary";
const outlineButtonClass = "button button--outline";

const MODE_TITLES: Record<Mode, string> = {
  CHOOSE: "360° 사진 추가",
  UPLOAD: "360° 사진 넣기",
  CAPTURE: "360° 사진 찍기",
  REVIEW: "사진 검수",
  PREVIEW: "AI 합성 결과",
};

/** "이전" 버튼이 돌아갈 단계 — 합성 결과에서 돌아가면 사진을 바꿀 수 있는 검수 단계로 간다. */
const PREVIOUS_MODES: Record<Exclude<Mode, "CHOOSE">, Mode> = {
  UPLOAD: "CHOOSE",
  CAPTURE: "CHOOSE",
  REVIEW: "CAPTURE",
  PREVIEW: "REVIEW",
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
 *  - 찍기: 촬영 가이드대로 찍은 10장 → 검수(경고만, 막지 않음) → AI 합성 → 미리보기(다시 합성 가능) → 확정
 *    모바일(화면 폭 767px 이하, MessagesView와 같은 기준)은 칸을 누르면 카메라가 바로 켜진다.
 * 모달 형태는 `AuthModal`과 같다.
 */
export function PanoramaUploadModal({ onClose, onConfirm }: PanoramaUploadModalProps) {
  const [mode, setMode] = useState<Mode>("CHOOSE");
  const isMobile = useSyncExternalStore(subscribeMobile, getMobileSnapshot, () => false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 넣기
  const [panoramaFile, setPanoramaFile] = useState<File | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  // 휴대폰 파노라마로 보여 받지 않은 사진의 이름 — '360° 사진 찍기'로 안내한다.
  const [phoneRejected, setPhoneRejected] = useState<string | null>(null);

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
    setPhoneRejected(null);
    if (!file) return;

    try {
      const ratio = await readImageRatio(file);
      if (isPhonePanoramaRatio(ratio)) {
        // 휴대폰 "파노라마"로 찍은 가로로 긴 사진은 받지 않는다 — 위아래가 비어 둘러보기·3D 방 인식이 안 된다
        setPhoneRejected(file.name);
        return;
      }
      if (!isPanoramaRatio(ratio)) {
        setError("가로:세로가 2:1인 360° 사진을 골라 주세요.");
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
    <Modal label={MODE_TITLES[mode]} onClose={onClose} canClose={!busy}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="font-mono text-[0.66rem] font-medium uppercase tracking-[0.18em] text-soft">
            360° Photo
          </span>
          <h2 className="mt-1 section-title text-ink">{MODE_TITLES[mode]}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          aria-label="닫기"
          className="button button--outline shrink-0"
        >
          <IconX size={20} stroke={2} aria-hidden />
        </button>
      </div>

      {mode === "CHOOSE" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => goTo("UPLOAD")}
            className="flex flex-col items-start gap-3 border border-line p-5 text-left transition-colors hover:border-ink hover:bg-wash"
          >
            <IconUpload size={22} stroke={1.8} className="text-main-d" aria-hidden />
            <span className="text-lg font-bold text-ink">360° 사진 넣기</span>
            <span className="text-[0.84rem] leading-[1.6] text-soft">
              360° 카메라로 찍은 사진(가로:세로 2:1)을 올려요. 휴대폰 파노라마 사진은 위아래가 비어 받지 않아요 — 휴대폰이면 ‘360° 사진 찍기’를 써 주세요.
            </span>
          </button>
          <button
            type="button"
            onClick={() => goTo("CAPTURE")}
            className="flex flex-col items-start gap-3 border border-line p-5 text-left transition-colors hover:border-ink hover:bg-wash"
          >
            <IconCamera size={22} stroke={1.8} className="text-main-d" aria-hidden />
            <span className="text-lg font-bold text-ink">360° 사진 찍기</span>
            <span className="text-[0.84rem] leading-[1.6] text-soft">
              가이드에 맞춰 휴대폰으로 {PANORAMA_CAPTURE_STEPS.length}장을 찍어 올리면 AI가 360° 사진으로 합쳐 드려요.
            </span>
          </button>
        </div>
      )}

      {mode === "UPLOAD" && (
        <div className="flex flex-col gap-4">
          <label className={`flex cursor-pointer flex-col items-center gap-3 border-2 border-dashed border-line-2 bg-wash p-6 text-center transition-colors hover:border-ink focus-within:border-sky ${busy ? "pointer-events-none opacity-60" : ""}`}>
            <IconUpload size={28} stroke={1.5} aria-hidden />
            <span className="button button--primary">{panoramaFile ? "360° 사진 변경" : "360° 사진 선택"}</span>
            <span className="text-sm text-soft">
              {panoramaFile?.name ?? phoneRejected ?? "JPG · PNG — 360° 카메라로 찍은 2:1 사진 한 장"}
            </span>
            <input
              type="file"
              accept={PANORAMA_ACCEPT}
              disabled={busy}
              onChange={(e) => void handlePanoramaFileChange(e.target.files?.[0])}
              aria-label="360° 사진"
              className="sr-only"
            />
          </label>
          {phoneRejected && (
            // 휴대폰 파노라마는 위아래가 잘려 있어 받지 않고 — 우리 '360° 사진 찍기'(10장 → 2:1 360° 사진)로 안내한다
            <div role="alert" className="flex flex-wrap items-center gap-3 border-l-4 border-coral bg-wash px-4 py-3">
              <p className="min-w-0 flex-1 text-sm text-ink">
                <span className="font-semibold">휴대폰 파노라마 사진은 올릴 수 없어요.</span> 위아래가 담기지 않아 둘러볼 때 빈 곳이 크게 보이고,
                3D 방도 만들 수 없어요. 휴대폰으로 가이드에 맞춰 {PANORAMA_CAPTURE_STEPS.length}장을 찍으면 위아래까지 채운 360° 사진을 만들어 드려요.
              </p>
              <button
                type="button"
                onClick={() => {
                  setPhoneRejected(null);
                  goTo("CAPTURE");
                }}
                disabled={busy}
                className="button button--primary shrink-0"
              >
                <IconCamera size={16} stroke={2} aria-hidden />
                360° 사진 찍기로 가기
              </button>
            </div>
          )}
          {localPreviewUrl && (
            <PanoramaViewer src={localPreviewUrl} className="h-[300px] sm:h-[360px]" />
          )}
        </div>
      )}

      {mode === "CAPTURE" && (
        <PanoramaCaptureGuide files={captureFiles} onFileChange={handleCaptureFileChange} mobile={isMobile} disabled={busy} />
      )}

      {mode === "REVIEW" && allCaptured && (
        <PanoramaCaptureReview
          files={captureFiles as File[]}
          onFileChange={handleCaptureFileChange}
          mobile={isMobile}
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

      {mode !== "CHOOSE" && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => goTo(PREVIOUS_MODES[mode])}
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

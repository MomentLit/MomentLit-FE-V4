"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { IconArrowLeft, IconArrowRight, IconCamera, IconRefresh, IconUpload, IconX } from "@tabler/icons-react";
import { Modal } from "@/shared/ui/Modal";
import { stitchPanorama, uploadPanorama } from "@/shared/api/upload";
import { getErrorMessage } from "@/shared/api/error";
import {
  PANORAMA_ACCEPT,
  PANORAMA_CAPTURE_STEPS,
  PHONE_PANORAMA_MAX_FOV,
  PHONE_PANORAMA_MAX_SHIFT,
  PHONE_PANORAMA_MIN_FOV,
  downscaleForStitch,
  estimatePhonePanoramaFov,
  isPanoramaRatio,
  isPhonePanoramaRatio,
  readImageRatio,
  renderPhonePanorama,
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
  // 폰 파노라마 — 원본을 들고 있다가 각도·위아래를 바꿀 때마다 360° 사진으로 다시 만든다.
  const [phoneSource, setPhoneSource] = useState<{ bitmap: ImageBitmap; name: string } | null>(null);
  const [phoneFov, setPhoneFov] = useState(PHONE_PANORAMA_MAX_FOV);
  const [phoneShift, setPhoneShift] = useState(0);

  // 찍기
  const [captureFiles, setCaptureFiles] = useState<(File | null)[]>(createEmptySlots);
  const [stitchedUrl, setStitchedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!localPreviewUrl) return;
    return () => URL.revokeObjectURL(localPreviewUrl);
  }, [localPreviewUrl]);

  useEffect(() => {
    if (!phoneSource) return;
    return () => phoneSource.bitmap.close();
  }, [phoneSource]);

  // 각도·위아래를 바꾸면 잠깐 기다렸다가(슬라이더를 끄는 동안 매번 만들지 않게) 360° 사진을 다시 만든다.
  useEffect(() => {
    if (!phoneSource) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      renderPhonePanorama(phoneSource.bitmap, phoneFov, phoneShift, phoneSource.name)
        .then((file) => {
          if (cancelled) return;
          setPanoramaFile(file);
          setLocalPreviewUrl(URL.createObjectURL(file));
        })
        .catch((renderError) => !cancelled && setError(getErrorMessage(renderError)));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [phoneSource, phoneFov, phoneShift]);

  function goTo(next: Mode) {
    setMode(next);
    setError(null);
  }

  async function handlePanoramaFileChange(file: File | undefined) {
    setError(null);
    setPanoramaFile(null);
    setLocalPreviewUrl(null);
    setPhoneSource(null);
    if (!file) return;

    try {
      const ratio = await readImageRatio(file);
      if (isPhonePanoramaRatio(ratio)) {
        // 휴대폰 "파노라마"로 찍은 가로로 긴 사진 — 360° 사진 가운데에 펼쳐 놓는다(위 효과가 만들어 준다).
        setPhoneFov(estimatePhonePanoramaFov(ratio));
        setPhoneShift(0);
        setPhoneSource({ bitmap: await createImageBitmap(file), name: file.name });
        return;
      }
      if (!isPanoramaRatio(ratio)) {
        setError("360° 사진(가로:세로 2:1)이나 휴대폰 파노라마처럼 가로로 긴 사진을 골라 주세요.");
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
              360° 카메라로 찍은 사진(가로:세로 2:1)이나 휴대폰 카메라의 파노라마 사진을 올려요.
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
              {phoneSource?.name ?? panoramaFile?.name ?? "JPG · PNG — 360° 사진(2:1) 또는 휴대폰 파노라마 사진 한 장"}
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
          {phoneSource && (
            <div className="flex flex-col gap-3 border border-line p-4">
              <p className="text-sm text-ink">
                휴대폰 파노라마 사진이에요. 찍은 각도에 맞게 펼치면 360° 사진처럼 둘러볼 수 있어요.
                사진에 담기지 않은 위아래는 회색으로 채워져요.
              </p>
              <label className="flex flex-col gap-1 text-sm font-semibold text-ink">
                찍은 가로 각도 — {phoneFov}°
                <input
                  type="range"
                  min={PHONE_PANORAMA_MIN_FOV}
                  max={PHONE_PANORAMA_MAX_FOV}
                  step={5}
                  value={phoneFov}
                  disabled={busy}
                  onChange={(e) => setPhoneFov(Number(e.target.value))}
                />
                <span className="text-xs font-normal text-soft">한 바퀴를 다 돌며 찍었으면 360°, 반 바퀴면 180°예요. 미리보기에서 물건 모양이 자연스러워지는 값을 골라요.</span>
              </label>
              <label className="flex flex-col gap-1 text-sm font-semibold text-ink">
                위아래 맞추기 — {phoneShift > 0 ? `위로 ${phoneShift}°` : phoneShift < 0 ? `아래로 ${-phoneShift}°` : "가운데"}
                <input
                  type="range"
                  min={-PHONE_PANORAMA_MAX_SHIFT}
                  max={PHONE_PANORAMA_MAX_SHIFT}
                  step={1}
                  value={phoneShift}
                  disabled={busy}
                  onChange={(e) => setPhoneShift(Number(e.target.value))}
                />
                <span className="text-xs font-normal text-soft">휴대폰을 위나 아래로 기울여 찍었으면, 수평선이 화면 가운데 오도록 옮겨요.</span>
              </label>
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

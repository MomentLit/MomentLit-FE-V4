"use client";

import { useEffect, useRef, useState } from "react";
import { IconCamera } from "@tabler/icons-react";
import type { PanoramaCaptureStep } from "../model";

export function PanoramaCamera({ step, onCapture, onCancel }: {
  step: PanoramaCaptureStep;
  onCapture: (photo: File) => void;
  onCancel: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [encoding, setEncoding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let active = true;
    let stream: MediaStream | undefined;

    async function openCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("이 브라우저에서는 카메라를 열 수 없어요. HTTPS로 접속하거나 카메라를 지원하는 브라우저에서 열어 주세요.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        if (video) {
          video.srcObject = stream;
          await video.play();
          if (active) setReady(true);
        }
      } catch (cameraError) {
        stream?.getTracks().forEach((track) => track.stop());
        if (!active) return;
        setError(cameraError instanceof DOMException && cameraError.name === "NotAllowedError"
          ? "카메라 접근을 허용한 뒤 다시 촬영해 주세요."
          : "카메라를 열 수 없어요. 카메라가 연결되어 있고 다른 앱에서 사용 중이지 않은지 확인해 주세요.");
      }
    }

    void openCamera();
    return () => {
      active = false;
      video.srcObject = null;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight || encoding) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      setError("사진을 저장할 수 없어요. 다른 브라우저에서 다시 시도해 주세요.");
      return;
    }
    setEncoding(true);
    context.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (videoRef.current !== video) return;
      setEncoding(false);
      if (blob) onCapture(new File([blob], `panorama-${step.label}.jpg`, { type: "image/jpeg" }));
      else setError("사진을 저장하지 못했어요. 다시 촬영해 주세요.");
    }, "image/jpeg", 0.92);
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-base font-bold text-ink">{step.label} · {step.direction}</h3>
        <p className="text-sm text-soft">{step.hint}</p>
      </div>
      <video ref={videoRef} autoPlay muted playsInline aria-label="카메라 미리보기" className="aspect-video max-h-[45dvh] w-full bg-wash object-contain" />
      {error && <p role="alert" className="text-sm text-coral">{error}</p>}
      {!ready && !error && <p role="status" className="text-sm text-soft">카메라를 여는 중…</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onCancel} className="button button--outline">돌아가기</button>
        <button type="button" onClick={capture} disabled={!ready || encoding} className="button button--primary">
          <IconCamera size={16} stroke={2} aria-hidden />
          촬영
        </button>
      </div>
    </div>
  );
}

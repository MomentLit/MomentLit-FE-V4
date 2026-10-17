"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from "react";
import { clampCrop, containZoom, coverCrop, loadImageAspect, parsePhotoUrl, type PhotoCrop } from "@/shared/lib";
import { CroppedPhoto } from "./CroppedPhoto";
import { Modal } from "./Modal";

const MAX_ZOOM = 4;
/** 사진 전체가 틀에 들어오는 크기의 절반까지 줄일 수 있다 — 작은 사진을 억지로 늘리지 않게. */
const MIN_ZOOM_OF_CONTAIN = 0.5;

export interface PhotoCropModalProps {
  /** 미리보기 URL(blob 또는 S3) — `#crop=` 이 붙어 있어도 원본 기준으로 연다. */
  src: string;
  /** 틀 비율(가로/세로) — 공간 상세 맨 위 사진 영역과 같은 값. */
  aspect: number;
  initialCrop: PhotoCrop | null;
  onApply: (crop: PhotoCrop) => void;
  onClose: () => void;
}

/**
 * 사진 위치 조절 — 상세 페이지 맨 위와 같은 비율의 틀 안에서 드래그로 옮기고
 * 슬라이더·휠로 확대·축소한다. 틀보다 작게 줄이면 남는 틈은 흐린 사진으로 채운다.
 * 사진은 자르지 않고 보여줄 영역(`PhotoCrop`)만 돌려준다.
 */
export function PhotoCropModal({ src, aspect, initialCrop, onApply, onClose }: PhotoCropModalProps) {
  const original = parsePhotoUrl(src).src;
  const frameRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; crop: PhotoCrop } | null>(null);
  const [imageAspect, setImageAspect] = useState<number | null>(null);
  const [crop, setCrop] = useState<PhotoCrop | null>(initialCrop);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadImageAspect(original)
      .then((ratio) => {
        if (cancelled) return;
        setImageAspect(ratio);
        setCrop((prev) => prev ?? coverCrop(ratio, aspect));
      })
      .catch(() => !cancelled && setLoadError(true));
    return () => {
      cancelled = true;
    };
  }, [original, aspect]);

  const base = imageAspect ? coverCrop(imageAspect, aspect) : null;
  const zoom = base && crop ? base.w / crop.w : 1;
  const minZoom = imageAspect ? containZoom(imageAspect, aspect) * MIN_ZOOM_OF_CONTAIN : 1;

  function zoomTo(nextZoom: number) {
    if (!imageAspect || !crop) return;
    const clamped = Math.min(Math.max(nextZoom, minZoom), MAX_ZOOM);
    setCrop(coverCrop(imageAspect, aspect, clamped, { x: crop.x + crop.w / 2, y: crop.y + crop.h / 2 }));
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!crop) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, crop };
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const frame = frameRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !frame) return;
    const { width, height } = frame.getBoundingClientRect();
    // 사진을 끄는 방향 = 보여줄 영역이 반대로 움직이는 방향.
    const dx = ((event.clientX - drag.startX) / width) * drag.crop.w;
    const dy = ((event.clientY - drag.startY) / height) * drag.crop.h;
    setCrop(clampCrop({ ...drag.crop, x: drag.crop.x - dx, y: drag.crop.y - dy }));
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  }

  function handleWheel(event: ReactWheelEvent<HTMLDivElement>) {
    zoomTo(zoom * (event.deltaY < 0 ? 1.08 : 1 / 1.08));
  }

  return (
    <Modal label="사진 위치 조절" onClose={onClose}>
      <div>
        <h2 className="text-xl font-bold tracking-tight text-ink">사진 위치 조절</h2>
        <p className="mt-1 text-sm text-soft">
          틀 안에 보이는 부분이 공간 상세 맨 위에 그대로 보여요. 사진을 끌어서 옮기고, 아래 막대나 마우스 휠로 크기를 바꿔 보세요. 작은 사진은 줄이면 덜 흐려 보여요.
        </p>
      </div>

      <div
        ref={frameRef}
        className="relative w-full cursor-grab touch-none select-none overflow-hidden bg-ink active:cursor-grabbing"
        style={{ aspectRatio: String(aspect) }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
      >
        {crop && <CroppedPhoto src={original} crop={crop} />}
        {/* 상세 페이지의 글자 영역 느낌을 살짝 보여줘서 제목이 얹힐 자리를 가늠하게 한다. */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20" />
        <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_0_2px_rgba(255,255,255,0.7)]" />
        {!crop && (
          <p className="absolute inset-0 grid place-items-center text-sm text-white/80">
            {loadError ? "사진을 불러오지 못했어요." : "사진을 불러오는 중…"}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex min-w-0 flex-1 items-center gap-3 text-sm font-bold text-ink">
          크기
          <input
            type="range"
            min={minZoom}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            disabled={!crop}
            onChange={(event) => zoomTo(Number(event.target.value))}
            aria-label="사진 크기"
            className="min-w-0 flex-1 accent-[var(--main-d)]"
          />
        </label>
        <button
          type="button"
          disabled={!imageAspect}
          onClick={() => imageAspect && setCrop(coverCrop(imageAspect, aspect))}
          className="button button--outline"
        >
          처음으로
        </button>
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="button button--outline">
          취소
        </button>
        <button type="button" disabled={!crop} onClick={() => crop && onApply(crop)} className="button button--primary disabled:opacity-60">
          적용
        </button>
      </div>
    </Modal>
  );
}

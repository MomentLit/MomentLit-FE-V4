"use client";

import { useEffect, useState } from "react";
import { IconChevronLeft, IconChevronRight, IconMaximize, IconView360, IconX } from "@tabler/icons-react";

import { Card } from "@/shared/ui";
import { Modal } from "@/shared/ui/Modal";
import { cn, cropHasGap, parsePhotoUrl } from "@/shared/lib";
import { CroppedPhoto } from "@/shared/ui/CroppedPhoto";
import { SPACE_CATEGORY_COLORS, SPACE_CATEGORY_LABELS } from "@/entities/space-category";
import { REGION_LABELS } from "@/entities/region";
import { getSpacePhotoUrls, splitSpaceOptionName, type SpaceDetail } from "@/entities/space";
import { PanoramaViewerModal, resolvePanoramaScenes } from "@/widgets/panorama";

/** 사진이 여러 장일 때 다음 사진으로 넘어가는 간격. */
const AUTOPLAY_MS = 4500;

/**
 * 사진 한 장. 호스트가 위치 조절한 사진(`#crop=`)은 PC에서 맞춘 영역을 그대로 보여준다
 * (영역 비율 = `SPACE_HERO_ASPECT` = 이 틀 비율). 모바일은 아직 따로 맞추지 않아서 그
 * 영역 가운데를 기준으로 꽉 채우고, 줄여서 맞춘 사진이면 잘리지 않게 전체를 보여준다.
 * 위치 조절 전에 올린 사진은 PC·모바일 모두 전체를 보여준다.
 */
function HeroSlide({ url }: { url: string }) {
  const { src, crop } = parsePhotoUrl(url);
  if (!crop) return <ContainedPhoto src={src} />;
  return (
    <>
      <div className="absolute inset-0 hidden sm:block">
        <CroppedPhoto src={src} crop={crop} />
      </div>
      <div className="absolute inset-0 sm:hidden">
        {cropHasGap(crop) ? (
          <ContainedPhoto src={src} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- 외부 S3 URL
          <img
            src={src}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            style={{ objectPosition: `${(crop.x + crop.w / 2) * 100}% ${(crop.y + crop.h / 2) * 100}%` }}
          />
        )}
      </div>
    </>
  );
}

/** 잘리지 않게 비율 그대로 보여주고 남는 여백은 같은 사진을 흐리게 깔아 채운다. */
function ContainedPhoto({ src }: { src: string }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- 외부 S3 URL, 비율이 다른 사진의 여백 채우기용 */}
      <img src={src} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl" />
      {/* eslint-disable-next-line @next/next/no-img-element -- 외부 S3 URL */}
      <img src={src} alt="" className="absolute inset-0 h-full w-full object-contain" />
    </>
  );
}

/** 원본 보기 — 위치 조절과 상관없이 올린 사진 전체를 크게 보여준다. 좌우 화살표 키로도 넘긴다. */
function PhotoViewer({ photos, index, onIndexChange, onClose }: { photos: string[]; index: number; onIndexChange: (index: number) => void; onClose: () => void }) {
  const multiple = photos.length > 1;
  const move = (delta: number) => onIndexChange((index + delta + photos.length) % photos.length);

  useEffect(() => {
    if (!multiple) return;
    function handleKey(event: KeyboardEvent) {
      if (event.key === "ArrowLeft") onIndexChange((index - 1 + photos.length) % photos.length);
      if (event.key === "ArrowRight") onIndexChange((index + 1) % photos.length);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [index, multiple, onIndexChange, photos.length]);

  return (
    <Modal label="사진 원본 보기" onClose={onClose} panelClassName="relative flex w-full max-w-[1400px] flex-col items-center gap-3 bg-transparent p-0">
      <div className="flex w-full items-center justify-between gap-3 text-white">
        <span className="font-mono text-sm" aria-live="polite">{multiple ? `${index + 1} / ${photos.length}` : "원본"}</span>
        <button type="button" onClick={onClose} aria-label="닫기" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 hover:bg-white/30">
          <IconX size={20} stroke={2.5} aria-hidden />
        </button>
      </div>
      <div className="relative flex w-full items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- 외부 S3 URL */}
        <img src={parsePhotoUrl(photos[index]).src} alt={`사진 ${index + 1}`} className="max-h-[82dvh] max-w-full object-contain" />
        {multiple && (
          <>
            <button type="button" onClick={() => move(-1)} aria-label="이전 사진" className="absolute left-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white hover:bg-black/80">
              <IconChevronLeft size={24} stroke={2.5} aria-hidden />
            </button>
            <button type="button" onClick={() => move(1)} aria-label="다음 사진" className="absolute right-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white hover:bg-black/80">
              <IconChevronRight size={24} stroke={2.5} aria-hidden />
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}

/**
 * Hero band — host가 올린 사진이 있으면 사진을, 없으면 카테고리 색상 필드를 보여준다.
 * 여러 장이면 옆으로 미끄러지며 자동으로 넘어가고(마우스를 올리거나 포커스하면 멈춤,
 * 움직임 줄이기 설정이면 자동 재생 안 함), 양옆 화살표로 직접 넘길 수 있다. 사진을
 * 누르면 원본을 크게 본다. PC에선 틀이 `SPACE_HERO_ASPECT`(2:1)로 고정돼 위치 조절한
 * 모습 그대로 보인다. Ported from design-reference `.dt-hero`.
 */
export function DetailHero({ space, hasOptions = false }: { space: SpaceDetail; hasOptions?: boolean }) {
  const tone = SPACE_CATEGORY_COLORS[space.category];
  const { address } = space;
  const shortLocation = address.region ? REGION_LABELS[address.region] : address.sido;
  const fullLocation = `${address.sido} ${address.sigungu} ${address.eup_myeon_dong}`;
  const photos = getSpacePhotoUrls(space);
  const hasPhoto = photos.length > 0;
  const [photoIndex, setPhotoIndex] = useState(0);
  const currentIndex = Math.min(photoIndex, Math.max(0, photos.length - 1));
  const [paused, setPaused] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [panoramaOpen, setPanoramaOpen] = useState(false);
  // 장면 기능 이전에 저장된 공간은 장면 목록이 비어 있어서 `panorama_url` 한 장으로 보여준다.
  const panoramaScenes = resolvePanoramaScenes(space.panorama_scenes, space.panorama_url);
  const hasPanorama = panoramaScenes.length > 0;

  // 구역으로 묶인 공간이면 제목은 공통 이름만 쓰고, 구역 이름은 아래 탭과 제목 위 라벨로 보여준다.
  const { baseName, optionLabel } = splitSpaceOptionName(space.name);
  const title = hasOptions ? baseName : space.name;

  const showPhoto = (delta: number) => setPhotoIndex((index) => (index + delta + photos.length) % photos.length);

  // 사진이 바뀔 때마다 타이머를 새로 건다 — 화살표로 넘긴 직후 바로 또 넘어가지 않게.
  useEffect(() => {
    if (photos.length < 2 || paused || viewerIndex !== null) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setTimeout(() => setPhotoIndex((index) => (index + 1) % photos.length), AUTOPLAY_MS);
    return () => window.clearTimeout(timer);
  }, [currentIndex, paused, photos.length, viewerIndex]);

  return (
    <>
      <Card
        tone={hasPhoto ? undefined : tone}
        className={cn(
          "relative flex min-h-[300px] flex-col justify-between gap-8 overflow-hidden rounded-3xl rounded-b-none p-6 sm:p-10",
          hasPhoto ? "cursor-zoom-in sm:aspect-[2/1] sm:min-h-0" : "sm:min-h-[420px]",
        )}
        onClick={(event) => {
          // 화살표·360° 버튼을 누른 건 원본 보기로 치지 않는다.
          if (hasPhoto && !(event.target as HTMLElement).closest("button, a")) setViewerIndex(currentIndex);
        }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
        }}
      >
        {hasPhoto && (
          <>
            <div
              className="absolute inset-0 flex transition-transform duration-700 ease-out motion-reduce:transition-none"
              style={{ transform: `translateX(-${currentIndex * 100}%)` }}
            >
              {photos.map((photo, index) => (
                <div key={photo} className="relative h-full w-full shrink-0 overflow-hidden bg-ink" aria-hidden={index !== currentIndex}>
                  <HeroSlide url={photo} />
                </div>
              ))}
            </div>
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/40" />
          </>
        )}
        {photos.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => showPhoto(-1)}
              aria-label="이전 사진"
              className="absolute left-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/75 sm:left-5"
            >
              <IconChevronLeft size={22} stroke={2.5} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => showPhoto(1)}
              aria-label="다음 사진"
              className="absolute right-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/75 sm:right-5"
            >
              <IconChevronRight size={22} stroke={2.5} aria-hidden />
            </button>
            <div className="absolute bottom-4 right-4 z-10 flex items-center gap-2 sm:bottom-6 sm:right-6">
              <button
                type="button"
                onClick={() => setViewerIndex(currentIndex)}
                className="flex items-center gap-1 bg-black/55 px-2 py-1 text-xs font-bold text-white hover:bg-black/80"
              >
                <IconMaximize size={13} stroke={2.5} aria-hidden />
                원본 보기
              </button>
              <div className="flex items-center gap-1.5" aria-hidden>
                {photos.map((photo, index) => (
                  <span
                    key={photo}
                    className={cn("h-1.5 rounded-full bg-white transition-all duration-300", index === currentIndex ? "w-5" : "w-1.5 opacity-50")}
                  />
                ))}
              </div>
              <span className="min-w-12 bg-black/55 px-2 py-1 text-center font-mono text-xs text-white" aria-live={paused ? "polite" : "off"}>
                {currentIndex + 1} / {photos.length}
              </span>
            </div>
          </>
        )}
        {photos.length === 1 && (
          <div className="absolute bottom-4 right-4 z-10 sm:bottom-6 sm:right-6">
            <button
              type="button"
              onClick={() => setViewerIndex(currentIndex)}
              className="flex items-center gap-1 bg-black/55 px-2 py-1 text-xs font-bold text-white hover:bg-black/80"
            >
              <IconMaximize size={13} stroke={2.5} aria-hidden />
              원본 보기
            </button>
          </div>
        )}
        {hasPanorama && (
          <button type="button" onClick={() => setPanoramaOpen(true)} className="button button--outline absolute right-4 top-4 z-10 sm:right-6 sm:top-6">
            <IconView360 size={18} stroke={2} aria-hidden />
            360° 보기
          </button>
        )}
        <span
          className={cn(
            "relative font-mono text-[0.66rem] font-medium uppercase tracking-[0.14em]",
            hasPanorama && "pr-32",
            hasPhoto && "text-white",
          )}
        >
          {SPACE_CATEGORY_LABELS[space.category]} · {shortLocation}
          {hasOptions && optionLabel && ` · ${optionLabel}`}
        </span>
        <div className="relative">
          <h1 className={cn("break-keep text-[clamp(2.2rem,5vw,4.5rem)] font-extrabold leading-tight tracking-tight", hasPhoto && "text-white")}>
            {title}
          </h1>
          <p className={cn("mt-2 text-sm opacity-90 sm:text-base", hasPhoto && "text-white")}>{fullLocation}</p>
        </div>
      </Card>
      {viewerIndex !== null && photos[viewerIndex] && (
        <PhotoViewer photos={photos} index={viewerIndex} onIndexChange={setViewerIndex} onClose={() => setViewerIndex(null)} />
      )}
      {panoramaOpen && hasPanorama && (
        <PanoramaViewerModal scenes={panoramaScenes} title={space.name} onClose={() => setPanoramaOpen(false)} />
      )}
    </>
  );
}

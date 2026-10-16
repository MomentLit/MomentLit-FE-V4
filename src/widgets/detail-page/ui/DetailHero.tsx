"use client";

import { useState } from "react";
import { IconChevronLeft, IconChevronRight, IconView360 } from "@tabler/icons-react";

import { Card } from "@/shared/ui";
import { cn } from "@/shared/lib";
import { SPACE_CATEGORY_COLORS, SPACE_CATEGORY_LABELS } from "@/entities/space-category";
import { REGION_LABELS } from "@/entities/region";
import { getSpacePhotoUrls, type SpaceDetail } from "@/entities/space";
import { PanoramaViewerModal } from "@/widgets/panorama";

/**
 * Hero band — host가 올린 사진이 있으면 사진을(여러 장이면 좌우로 넘겨볼 수 있다), 없으면 카테고리 색상 필드를 보여준다.
 * Ported from design-reference `.dt-hero`.
 */
export function DetailHero({ space }: { space: SpaceDetail }) {
  const tone = SPACE_CATEGORY_COLORS[space.category];
  const { address } = space;
  const shortLocation = address.region ? REGION_LABELS[address.region] : address.sido;
  const fullLocation = `${address.sido} ${address.sigungu} ${address.eup_myeon_dong}`;
  const photos = getSpacePhotoUrls(space);
  const hasPhoto = photos.length > 0;
  const [photoIndex, setPhotoIndex] = useState(0);
  const currentPhoto = photos[Math.min(photoIndex, photos.length - 1)];
  const [panoramaOpen, setPanoramaOpen] = useState(false);

  const showPhoto = (delta: number) => setPhotoIndex((index) => (index + delta + photos.length) % photos.length);

  return (
    <>
      <Card
        tone={hasPhoto ? undefined : tone}
        className="relative flex min-h-[300px] flex-col justify-between gap-8 overflow-hidden rounded-3xl rounded-b-none p-6 sm:min-h-[420px] sm:p-10"
      >
        {hasPhoto && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- 외부 S3 URL */}
            <img src={currentPhoto} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/40" />
          </>
        )}
        {photos.length > 1 && (
          <div className="absolute bottom-4 right-4 z-10 flex items-center gap-1 sm:bottom-6 sm:right-6">
            <button
              type="button"
              onClick={() => showPhoto(-1)}
              aria-label="이전 사진"
              className="flex h-9 w-9 items-center justify-center bg-black/55 text-white hover:bg-black/80"
            >
              <IconChevronLeft size={18} stroke={2.5} aria-hidden />
            </button>
            <span className="min-w-14 bg-black/55 px-2 py-2 text-center font-mono text-xs text-white" aria-live="polite">
              {Math.min(photoIndex, photos.length - 1) + 1} / {photos.length}
            </span>
            <button
              type="button"
              onClick={() => showPhoto(1)}
              aria-label="다음 사진"
              className="flex h-9 w-9 items-center justify-center bg-black/55 text-white hover:bg-black/80"
            >
              <IconChevronRight size={18} stroke={2.5} aria-hidden />
            </button>
          </div>
        )}
        {space.panorama_url && (
          <button type="button" onClick={() => setPanoramaOpen(true)} className="button button--outline absolute right-4 top-4 z-10 sm:right-6 sm:top-6">
            <IconView360 size={18} stroke={2} aria-hidden />
            360° 보기
          </button>
        )}
        <span
          className={cn(
            "relative font-mono text-[0.66rem] font-medium uppercase tracking-[0.14em]",
            space.panorama_url && "pr-32",
            hasPhoto && "text-white",
          )}
        >
          {SPACE_CATEGORY_LABELS[space.category]} · {shortLocation}
        </span>
        <div className="relative">
          <h1 className={cn("break-keep text-[clamp(2.2rem,5vw,4.5rem)] font-extrabold leading-tight tracking-tight", hasPhoto && "text-white")}>
            {space.name}
          </h1>
          <p className={cn("mt-2 text-sm opacity-90 sm:text-base", hasPhoto && "text-white")}>{fullLocation}</p>
        </div>
      </Card>
      {panoramaOpen && space.panorama_url && (
        <PanoramaViewerModal src={space.panorama_url} title={space.name} onClose={() => setPanoramaOpen(false)} />
      )}
    </>
  );
}

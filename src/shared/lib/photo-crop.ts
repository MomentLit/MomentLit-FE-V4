import type { CSSProperties } from "react";

/**
 * 사진에서 보여줄 영역 — 원본 크기 대비 비율. 보통 0~1 안이지만, 사진을 틀보다 작게
 * 줄이면 영역이 사진보다 커져서 `w`/`h`가 1을 넘고 `x`/`y`가 음수가 된다(남는 틈은
 * 같은 사진을 흐리게 깔아 채운다). 원본은 그대로 업로드하고 이 값만
 * URL 끝에 `#crop=x,y,w,h`로 붙여 저장한다. 브라우저는 `#` 뒤를 서버로 보내지 않아서
 * 사진은 원본 그대로 열리고(원본 보기 가능), FE만 이 값을 읽어 틀에 맞춰 보여준다.
 * 백엔드에 따로 저장할 필드가 없어서 쓰는 방식이다.
 */
export interface PhotoCrop {
  x: number;
  y: number;
  w: number;
  h: number;
}

const CROP_PATTERN = /#crop=(-?[\d.]+),(-?[\d.]+),([\d.]+),([\d.]+)$/;

const round = (value: number) => Math.round(value * 10000) / 10000;

/** 저장된 URL → 원본 주소와 맞춘 영역(없으면 null). */
export function parsePhotoUrl(url: string): { src: string; crop: PhotoCrop | null } {
  const match = url.match(CROP_PATTERN);
  if (!match) return { src: url, crop: null };
  const [x, y, w, h] = match.slice(1).map(Number);
  const valid = [x, y, w, h].every(Number.isFinite) && w > 0 && h > 0;
  return { src: url.slice(0, match.index), crop: valid ? { x, y, w, h } : null };
}

/** 원본 주소에 맞춘 영역을 붙인다 — `crop`이 없으면 원본 주소 그대로. */
export function withPhotoCrop(src: string, crop: PhotoCrop | null | undefined): string {
  const base = parsePhotoUrl(src).src;
  if (!crop) return base;
  return `${base}#crop=${round(crop.x)},${round(crop.y)},${round(crop.w)},${round(crop.h)}`;
}

/**
 * 원본 비율이 `imageAspect`(가로/세로)인 사진을 `frameAspect` 틀에 꽉 채우는 가장 큰 영역을
 * `zoom`배 확대한 크기 — 가운데 정렬. 위치 조절의 기본값이자 확대/축소의 기준.
 */
export function coverCrop(imageAspect: number, frameAspect: number, zoom = 1, center = { x: 0.5, y: 0.5 }): PhotoCrop {
  const baseW = imageAspect > frameAspect ? frameAspect / imageAspect : 1;
  const baseH = imageAspect > frameAspect ? 1 : imageAspect / frameAspect;
  const w = baseW / zoom;
  const h = baseH / zoom;
  return clampCrop({ x: center.x - w / 2, y: center.y - h / 2, w, h });
}

/**
 * 위치만 당겨 넣는다 — 영역이 사진보다 작으면 사진 밖으로 못 나가게, 사진보다 크면
 * (줄였을 때) 사진이 틀 밖으로 못 나가게.
 */
export function clampCrop(crop: PhotoCrop): PhotoCrop {
  const clampAxis = (start: number, size: number) => Math.min(Math.max(start, Math.min(0, 1 - size)), Math.max(0, 1 - size));
  return { ...crop, x: clampAxis(crop.x, crop.w), y: clampAxis(crop.y, crop.h) };
}

/** 영역이 사진보다 커서(줄여서) 틀에 빈 틈이 생기는지 — 생기면 흐린 사진으로 채운다. */
export function cropHasGap(crop: PhotoCrop): boolean {
  return crop.w > 1.0001 || crop.h > 1.0001 || crop.x < -0.0001 || crop.y < -0.0001;
}

/** 사진 전체가 틀 안에 들어오는 배율(`coverCrop`의 `zoom` 기준) — 1보다 작다. */
export function containZoom(imageAspect: number, frameAspect: number): number {
  return imageAspect > frameAspect ? frameAspect / imageAspect : imageAspect / frameAspect;
}

/**
 * 틀(같은 비율, `position: relative; overflow: hidden`) 안의 `<img>`에 주면 맞춘 영역만
 * 정확히 틀에 차게 보이는 스타일.
 */
export function cropImageStyle(crop: PhotoCrop): CSSProperties {
  return {
    position: "absolute",
    maxWidth: "none",
    width: `${100 / crop.w}%`,
    height: `${100 / crop.h}%`,
    left: `${(-crop.x / crop.w) * 100}%`,
    top: `${(-crop.y / crop.h) * 100}%`,
  };
}

/** 파일·URL 사진의 원본 가로/세로 비율. */
export function loadImageAspect(src: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image.naturalWidth / image.naturalHeight);
    image.onerror = () => reject(new Error("사진을 불러오지 못했어요."));
    image.src = parsePhotoUrl(src).src;
  });
}

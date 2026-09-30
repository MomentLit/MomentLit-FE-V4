/**
 * 360도 사진 촬영 가이드.
 *
 * 수평 45° 간격 8장 + 천장 1장 + 바닥 1장 = 10장. 휴대폰 기본 카메라를 가로로 들면
 * 수평 화각이 대략 65° 안팎이라, 45° 간격이면 이웃 사진끼리 1/3가량 겹쳐서 합성에 필요한
 * 공통 영역이 생긴다. 천장·바닥은 구면의 위아래 빈 곳을 채우는 용도.
 *
 * 장수와 순서는 백엔드 `ImageService.PANORAMA_SOURCE_COUNT`와 반드시 맞출 것 —
 * `stitchPanorama()`는 이 배열 순서 그대로 파일을 보낸다.
 */
export interface PanoramaCaptureStep {
  label: string;
  direction: string;
  hint: string;
}

export const PANORAMA_CAPTURE_STEPS: readonly PanoramaCaptureStep[] = [
  { label: "01", direction: "정면 0°", hint: "공간 가운데에 서서 기준이 될 방향을 찍어요." },
  { label: "02", direction: "오른쪽 45°", hint: "제자리에서 오른쪽으로 45° 돌아서 찍어요." },
  { label: "03", direction: "오른쪽 90°", hint: "한 번 더 45° 돌아서 찍어요." },
  { label: "04", direction: "오른쪽 135°", hint: "한 번 더 45° 돌아서 찍어요." },
  { label: "05", direction: "뒤쪽 180°", hint: "정면의 정반대 방향이에요." },
  { label: "06", direction: "왼쪽 135°", hint: "한 번 더 45° 돌아서 찍어요." },
  { label: "07", direction: "왼쪽 90°", hint: "한 번 더 45° 돌아서 찍어요." },
  { label: "08", direction: "왼쪽 45°", hint: "마지막 수평 사진이에요. 정면 사진과도 겹치게 찍어요." },
  { label: "09", direction: "천장", hint: "정면을 보고 선 채로 휴대폰을 위로 향해 찍어요." },
  { label: "10", direction: "바닥", hint: "정면을 보고 선 채로 휴대폰을 아래로 향해 찍어요." },
];

export const PANORAMA_CAPTURE_TIPS = [
  "휴대폰을 가로로 들고, 발 위치는 그대로 둔 채 제자리에서 몸만 돌려요.",
  "이웃한 사진끼리 1/3 정도 겹치게 찍어요.",
  "찍는 동안 조명을 바꾸지 말고, 움직이는 사람이나 물체가 없을 때 찍어요.",
] as const;

/** 가이드 촬영 사진 — 일반 이미지 업로드(`uploadImage`)와 같은 형식. */
export const CAPTURE_ACCEPT = "image/jpeg,image/png,image/webp";

/** 이미 만들어진 360도 사진 — 서버가 비율 검증을 ImageIO로 해서 webp는 받지 않는다. */
export const PANORAMA_ACCEPT = "image/jpeg,image/png";

/** 등장방형(equirectangular) 360도 사진은 가로:세로 = 2:1. 서버와 같은 허용 오차. */
const PANORAMA_RATIO = 2;
const PANORAMA_RATIO_TOLERANCE = 0.02;

/** 업로드 전에 브라우저에서 먼저 가로:세로 비율을 확인한다 — 서버도 같은 검증을 한 번 더 한다. */
export function readImageRatio(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image.naturalWidth / image.naturalHeight);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("이미지를 읽을 수 없어요."));
    };
    image.src = url;
  });
}

export function isPanoramaRatio(ratio: number): boolean {
  return Math.abs(ratio - PANORAMA_RATIO) <= PANORAMA_RATIO_TOLERANCE;
}

/** 합성용 사진의 긴 변 최대 길이 — 10장을 한 번에 보내므로 요청 크기와 합성 시간을 줄인다. */
const STITCH_MAX_SIDE = 1600;

/**
 * AI 합성 전에 브라우저에서 사진을 줄여 jpeg로 다시 만든다. `createImageBitmap`은 휴대폰 사진의
 * EXIF 회전 정보를 반영해서 그려주므로, 서버/AI 쪽에서 사진이 옆으로 누워 보이는 일도 막는다.
 */
export async function downscaleForStitch(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, STITCH_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("사진을 처리할 수 없어요.");
  }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
  if (!blob) throw new Error("사진을 처리할 수 없어요.");

  const baseName = file.name.replace(/\.[^.]+$/, "");
  return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
}

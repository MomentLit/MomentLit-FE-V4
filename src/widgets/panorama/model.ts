/**
 * 360도 사진 촬영 가이드.
 *
 * 수평 45° 간격 8장 + 천장 1장 + 바닥 1장 = 10장. 휴대폰 기본 카메라(1배)를 가로로 들어도
 * 수평 화각이 대략 65° 안팎이라, 45° 간격이면 이웃 사진끼리 1/3가량 겹쳐서 합성에 필요한
 * 공통 영역이 생긴다. 0.6배 광각을 권장하는 이유는 한 장에 위아래가 더 넓게 담겨서, 10장으로 덮지 못해
 * 주변 색으로 채우는 곳(수평 사진과 천장·바닥 사이)이 줄어들기 때문이다. 천장·바닥은 구면의 위아래 빈 곳을 채우는 용도 — 서버가 매칭하지 않고 "정면을 보고 선 채
 * 가로로 든 휴대폰을 그대로 젖히거나(천장) 숙인(바닥)" 방향에 바로 놓으므로, 가이드 문구도 그 자세를 정확히 안내한다.
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
  { label: "09", direction: "천장", hint: "정면을 보고 선 채, 가로로 든 휴대폰을 그대로 뒤로 젖혀 바로 위 천장을 찍어요." },
  { label: "10", direction: "바닥", hint: "정면을 보고 선 채, 가로로 든 휴대폰을 그대로 앞으로 숙여 바로 아래 바닥을 찍어요." },
];

export const PANORAMA_CAPTURE_TIPS = [
  "카메라를 0.6배 광각으로 맞추면 한 장에 더 넓게 담겨 빈 곳이 줄어요.",
  "휴대폰을 가로로 들고, 발 위치는 그대로 둔 채 제자리에서 몸만 돌려요.",
  "이웃한 사진끼리 1/3 정도 겹치게 찍어요.",
  "찍는 동안 조명을 바꾸지 말고, 움직이는 사람이나 물체가 없을 때 찍어요.",
] as const;

export interface PanoramaGuideSection {
  title: string;
  items: readonly string[];
}

/** PC 화면의 자세한 촬영 가이드 — 모바일은 화면이 좁아 위의 짧은 팁(`PANORAMA_CAPTURE_TIPS`)만 보여준다. */
export const PANORAMA_CAPTURE_DETAILED_GUIDE: readonly PanoramaGuideSection[] = [
  {
    title: "1. 촬영 전 준비",
    items: [
      "공간의 조명을 모두 켜고, 촬영이 끝날 때까지 바꾸지 않아요.",
      "사람이나 움직이는 물체가 화면에 들어오지 않을 때 찍어요.",
      "카메라는 0.6배 광각으로 맞춰 주세요. 한 장에 더 넓게 담겨 빈 곳이 줄어요. 0.6배가 없는 휴대폰은 기본 배율(1배)로 찍어요.",
      "줌·인물 모드, 플래시, HDR, 필터는 꺼 주세요.",
      "렌즈를 한 번 닦아 주면 사진이 뿌옇게 나오지 않아요.",
    ],
  },
  {
    title: "2. 서는 위치와 자세",
    items: [
      "공간 가운데쯤, 벽이나 가구에서 1.5m 이상 떨어진 곳에 서요.",
      "휴대폰을 가로로 들고 가슴 높이에서 수평을 맞춰요.",
      "돌 때는 발 위치를 바꾸지 말고 휴대폰을 중심으로 제자리에서 몸만 돌려요.",
    ],
  },
  {
    title: "3. 촬영 순서",
    items: [
      "1~8번은 정면에서 시작해 오른쪽으로 45°씩 돌며 찍어요. 8장을 찍으면 한 바퀴가 돼요.",
      "이웃한 사진끼리 1/3 정도 겹쳐야 이어 붙일 수 있어요. 앞 사진 오른쪽 끝에 있던 물건이 다음 사진 왼쪽에 보이면 돼요.",
      "9·10번은 1번(정면)을 보고 선 채, 가로로 든 휴대폰을 돌리지 말고 그대로 뒤로 젖혀 바로 위 천장(9번)을, 앞으로 숙여 바로 아래 바닥(10번)을 찍어요.",
      "천장·바닥 사진은 찍은 방향 그대로 위·아래에 놓여요. 비스듬히 찍지 말고 휴대폰이 천장·바닥과 나란하게 찍어 주세요.",
      "찍은 사진을 아래 칸에 순서대로 하나씩 넣어 주세요. 칸 순서가 바뀌면 합성할 수 없어요.",
    ],
  },
  {
    title: "4. 주의할 점",
    items: [
      "찍는 순간 흔들리면 합성이 실패할 수 있어요. 셔터를 누를 때 잠깐 멈춰 주세요.",
      "흰 벽이나 유리처럼 무늬가 없는 곳만 가득 찍히면 이어 붙이기 어려워요. 가구나 창틀이 조금씩 걸리게 찍어요.",
      "수평 사진과 천장·바닥 사진 사이처럼 어느 사진에도 찍히지 않은 곳은 주변 색으로 자연스럽게 채워져요.",
      "사진에 찍힌 사람 얼굴과 차량 번호판은 업로드할 때 자동으로 흐리게 처리돼요.",
    ],
  },
];

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

/** 1~8번은 휴대폰을 가로로 든 수평 사진, 9·10번은 천장·바닥 사진. */
const HORIZONTAL_STEP_COUNT = 8;

/** 이보다 짧은 변이 작으면 합성 품질이 떨어질 수 있다고 경고한다(합성 전 긴 변 1600px로 줄이므로 그 절반 안팎). */
const MIN_CAPTURE_SHORT_SIDE = 720;

export interface CapturePhotoSize {
  width: number;
  height: number;
}

/** `createImageBitmap`은 EXIF 회전을 반영하므로 실제로 보이는 방향 기준의 가로·세로를 얻는다. */
export async function readCapturePhotoSize(file: File): Promise<CapturePhotoSize> {
  const bitmap = await createImageBitmap(file);
  const size = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return size;
}

/** 이름·크기(바이트)가 모두 같으면 같은 사진으로 본다 — 수정 시각은 선택 방법에 따라 달라질 수 있어 비교하지 않는다. */
function isSameFile(a: File, b: File): boolean {
  return a.name === b.name && a.size === b.size;
}

/**
 * 합성 전 검수 — 칸마다 경고 문구 목록을 돌려준다(빈 배열이면 문제 없음).
 * 경고는 안내일 뿐 합성을 막지 않는다. `sizes[i]`가 null이면 사진을 읽지 못한 것.
 */
export function reviewCapturePhotos(
  files: readonly File[],
  sizes: readonly (CapturePhotoSize | null)[],
): string[][] {
  return files.map((file, index) => {
    const warnings: string[] = [];

    const duplicateIndex = files.findIndex((other, otherIndex) => otherIndex !== index && isSameFile(file, other));
    if (duplicateIndex !== -1) {
      warnings.push(`${PANORAMA_CAPTURE_STEPS[duplicateIndex].label}번 칸과 같은 사진이에요.`);
    }

    const size = sizes[index];
    if (!size) {
      warnings.push("사진을 읽을 수 없어요. 다른 사진으로 바꿔 주세요.");
      return warnings;
    }

    if (index < HORIZONTAL_STEP_COUNT && size.height > size.width) {
      warnings.push("세로로 찍힌 사진이에요. 휴대폰을 가로로 들고 찍어 주세요.");
    }

    if (Math.min(size.width, size.height) < MIN_CAPTURE_SHORT_SIDE) {
      warnings.push(`해상도가 낮아요(${size.width}×${size.height}). 합성 결과가 흐릴 수 있어요.`);
    }

    return warnings;
  });
}

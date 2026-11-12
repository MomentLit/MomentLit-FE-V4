/**
 * 사진 메시지 — 백엔드 메시지는 글자(`content`)만 저장해서, 사진은 `POST /images/upload`로 올린 뒤
 * `[사진] <주소>` 한 줄을 보낸다. 대화창은 이 줄을 사진으로 그리고, 이 규칙을 모르는 화면에서도
 * "[사진] https://…"로 읽혀서 뜻이 통한다. 백엔드에 첨부 칸이 생기면 이 규칙은 옛 메시지 읽기용으로만 남긴다.
 */
export const IMAGE_MESSAGE_PREFIX = "[사진] ";

/** 업로드 서버가 받는 형식·크기와 같게 맞춘다(ImageService · multipart max-file-size). */
export const MESSAGE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MESSAGE_IMAGE_MAX_BYTES = 20 * 1024 * 1024;
/** 한 번에 고를 수 있는 사진 수 — 사진마다 메시지가 하나씩 나간다. */
export const MESSAGE_IMAGE_MAX_COUNT = 5;

/**
 * 업로드 서버가 돌려주는 주소 형식(`https://{버킷}.s3.{리전}.amazonaws.com/images/{UUID}.{확장자}`)만
 * 사진으로 인정한다. 상대가 아무 외부 주소나 보내서 대화창에 낯선 이미지를 띄우거나(추적용 픽셀 등)
 * 하지 못하게 하려는 것 — 형식이 다르면 그냥 글자로 보인다.
 */
const S3_HOST = /^[a-z0-9.-]+\.s3\.[a-z0-9-]+\.amazonaws\.com$/;
const UPLOADED_IMAGE_PATH = /^\/images\/[0-9a-f-]{36}\.(?:jpg|png|webp)$/i;

export function isUploadedImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && S3_HOST.test(url.hostname) && UPLOADED_IMAGE_PATH.test(url.pathname) && !url.search;
  } catch {
    return false;
  }
}

export function toImageMessage(url: string): string {
  return `${IMAGE_MESSAGE_PREFIX}${url}`;
}

/** 사진 메시지면 사진 주소, 아니면 null. */
export function parseImageMessage(content: string): string | null {
  if (!content.startsWith(IMAGE_MESSAGE_PREFIX)) return null;
  const url = content.slice(IMAGE_MESSAGE_PREFIX.length).trim();
  return isUploadedImageUrl(url) ? url : null;
}

/** 고른 파일이 보낼 수 있는 사진인지 — 안 되면 이유를 돌려준다. */
export function validateMessageImage(file: File): string | null {
  if (!(MESSAGE_IMAGE_TYPES as readonly string[]).includes(file.type)) return "사진은 JPG·PNG·WEBP만 보낼 수 있어요.";
  if (file.size > MESSAGE_IMAGE_MAX_BYTES) return "사진 한 장은 20MB까지 보낼 수 있어요.";
  return null;
}

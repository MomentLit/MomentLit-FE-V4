import { apiClient } from "./client";
import type { ApiResponse } from "./types";

export interface UploadImageOptions {
  /** false면 서버의 얼굴·번호판 자동 블라인드를 건너뛴다 — 본인 얼굴이 주인공인 프로필 사진용. 기본값 true. */
  privacyBlur?: boolean;
}

/** `POST /images/upload` — multipart, jpeg/png/webp only (verified against `ImageController`). Returns the final S3 URL. */
export async function uploadImage(file: File, options: UploadImageOptions = {}): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await apiClient.post<ApiResponse<{ image_url: string }>>("/images/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    params: options.privacyBlur === false ? { "privacy-blur": false } : undefined,
  });
  return data.data.image_url;
}

/** `POST /images/panorama/upload` — 이미 만들어진 360도 사진 한 장. 서버가 jpeg/png·2:1 비율을 검증한다. Returns the final S3 URL. */
export async function uploadPanorama(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await apiClient.post<ApiResponse<{ image_url: string }>>("/images/panorama/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data.data.image_url;
}

/** `POST /images/panorama/stitch` — 촬영 가이드 순서대로 찍은 사진들을 AI가 한 장의 360도 사진으로 합성한다. Returns the final S3 URL. */
export async function stitchPanorama(files: File[]): Promise<string> {
  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }
  const { data } = await apiClient.post<ApiResponse<{ image_url: string }>>("/images/panorama/stitch", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data.data.image_url;
}

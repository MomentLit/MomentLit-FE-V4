import { apiClient } from "./client";
import type { ApiResponse } from "./types";

/** `POST /images/upload` — multipart, jpeg/png/webp only (verified against `ImageController`). Returns the final S3 URL. */
export async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await apiClient.post<ApiResponse<{ image_url: string }>>("/images/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data.data.image_url;
}

import { apiClient } from "@/shared/api/client";
import type { ApiResponse } from "@/shared/api/types";
import type { LikeStatus } from "./model";

export async function likeSpace(spaceId: number): Promise<LikeStatus> {
  const { data } = await apiClient.post<ApiResponse<LikeStatus>>(`/spaces/${spaceId}/likes`);
  return data.data;
}

export async function unlikeSpace(spaceId: number): Promise<LikeStatus> {
  const { data } = await apiClient.delete<ApiResponse<LikeStatus>>(`/spaces/${spaceId}/likes`);
  return data.data;
}

export async function fetchSpaceLikeStatus(spaceId: number): Promise<LikeStatus> {
  const { data } = await apiClient.get<ApiResponse<LikeStatus>>(`/spaces/${spaceId}/likes/me`);
  return data.data;
}

export async function likePopup(popupId: number): Promise<LikeStatus> {
  const { data } = await apiClient.post<ApiResponse<LikeStatus>>(`/popups/${popupId}/likes`);
  return data.data;
}

export async function unlikePopup(popupId: number): Promise<LikeStatus> {
  const { data } = await apiClient.delete<ApiResponse<LikeStatus>>(`/popups/${popupId}/likes`);
  return data.data;
}

export async function fetchPopupLikeStatus(popupId: number): Promise<LikeStatus> {
  const { data } = await apiClient.get<ApiResponse<LikeStatus>>(`/popups/${popupId}/likes/me`);
  return data.data;
}

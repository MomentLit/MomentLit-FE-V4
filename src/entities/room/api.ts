import axios from "axios";
import { apiClient, publicApiClient } from "@/shared/api/client";
import type { ApiResponse } from "@/shared/api/types";
import type { FurnitureItem, FurnitureLayout, LayoutJob, Room, RoomUpsertRequest } from "./model";

/** 360° 사진에서 방 모서리 찾기를 시작한다 — 결과는 `fetchLayoutJob`으로 폴링한다. 대기열이 가득 차면 503. */
export async function createLayoutJob(imageUrl: string): Promise<LayoutJob> {
  const { data } = await apiClient.post<ApiResponse<LayoutJob>>("/rooms/layout-jobs", { image_url: imageUrl });
  return data.data;
}

export async function fetchLayoutJob(jobId: string, signal?: AbortSignal): Promise<LayoutJob> {
  const { data } = await apiClient.get<ApiResponse<LayoutJob>>(`/rooms/layout-jobs/${jobId}`, { signal });
  return data.data;
}

/** 공간의 3D 방. 아직 없으면 null(서버는 404). */
export async function fetchRoom(spaceId: number): Promise<Room | null> {
  try {
    const { data } = await publicApiClient.get<ApiResponse<Room>>(`/spaces/${spaceId}/room`);
    return data.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) return null;
    throw error;
  }
}

export async function saveRoom(spaceId: number, request: RoomUpsertRequest): Promise<Room> {
  const { data } = await apiClient.put<ApiResponse<Room>>(`/spaces/${spaceId}/room`, request);
  return data.data;
}

export async function deleteRoom(spaceId: number): Promise<void> {
  await apiClient.delete(`/spaces/${spaceId}/room`);
}

/** 내가 저장한 가구 배치. 저장한 적 없으면 null. */
export async function fetchMyFurnitureLayout(spaceId: number): Promise<FurnitureLayout | null> {
  const { data } = await apiClient.get<ApiResponse<FurnitureLayout | null>>(`/spaces/${spaceId}/room/my-layout`);
  return data.data;
}

export async function saveMyFurnitureLayout(spaceId: number, items: FurnitureItem[]): Promise<FurnitureLayout> {
  const { data } = await apiClient.put<ApiResponse<FurnitureLayout>>(`/spaces/${spaceId}/room/my-layout`, { items });
  return data.data;
}

export async function deleteMyFurnitureLayout(spaceId: number): Promise<void> {
  await apiClient.delete(`/spaces/${spaceId}/room/my-layout`);
}

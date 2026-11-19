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

/** 내가 이 공간에 저장한 배치들, 최근에 고친 것부터. */
export async function fetchMyFurnitureLayouts(spaceId: number): Promise<FurnitureLayout[]> {
  const { data } = await apiClient.get<ApiResponse<FurnitureLayout[]>>(`/spaces/${spaceId}/room/layouts`);
  return data.data;
}

/** 새 배치로 저장. 이미 20개면 400. */
export async function createMyFurnitureLayout(spaceId: number, name: string, items: FurnitureItem[]): Promise<FurnitureLayout> {
  const { data } = await apiClient.post<ApiResponse<FurnitureLayout>>(`/spaces/${spaceId}/room/layouts`, { name, items });
  return data.data;
}

/** 내 배치 덮어쓰기(이름·가구). */
export async function updateMyFurnitureLayout(
  spaceId: number,
  layoutId: number,
  name: string,
  items: FurnitureItem[],
): Promise<FurnitureLayout> {
  const { data } = await apiClient.put<ApiResponse<FurnitureLayout>>(`/spaces/${spaceId}/room/layouts/${layoutId}`, { name, items });
  return data.data;
}

export async function deleteMyFurnitureLayout(spaceId: number, layoutId: number): Promise<void> {
  await apiClient.delete(`/spaces/${spaceId}/room/layouts/${layoutId}`);
}

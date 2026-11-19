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

/** 공간의 3D 방들(장면 순서대로). 없으면 빈 목록. */
export async function fetchRooms(spaceId: number): Promise<Room[]> {
  const { data } = await publicApiClient.get<ApiResponse<Room[]>>(`/spaces/${spaceId}/rooms`);
  return data.data;
}

export async function createRoom(spaceId: number, request: RoomUpsertRequest): Promise<Room> {
  const { data } = await apiClient.post<ApiResponse<Room>>(`/spaces/${spaceId}/rooms`, request);
  return data.data;
}

export async function updateRoom(spaceId: number, roomId: number, request: RoomUpsertRequest): Promise<Room> {
  const { data } = await apiClient.put<ApiResponse<Room>>(`/spaces/${spaceId}/rooms/${roomId}`, request);
  return data.data;
}

/** 방을 지우면 그 방에 사용자들이 저장한 가구 배치도 함께 지워진다. */
export async function deleteRoom(spaceId: number, roomId: number): Promise<void> {
  await apiClient.delete(`/spaces/${spaceId}/rooms/${roomId}`);
}

/** 내가 이 방에 저장한 배치들, 최근에 고친 것부터. */
export async function fetchMyFurnitureLayouts(spaceId: number, roomId: number): Promise<FurnitureLayout[]> {
  const { data } = await apiClient.get<ApiResponse<FurnitureLayout[]>>(`/spaces/${spaceId}/rooms/${roomId}/layouts`);
  return data.data;
}

/** 새 배치로 저장. 이미 20개면 400. */
export async function createMyFurnitureLayout(
  spaceId: number,
  roomId: number,
  name: string,
  items: FurnitureItem[],
): Promise<FurnitureLayout> {
  const { data } = await apiClient.post<ApiResponse<FurnitureLayout>>(`/spaces/${spaceId}/rooms/${roomId}/layouts`, { name, items });
  return data.data;
}

/** 내 배치 덮어쓰기(이름·가구). */
export async function updateMyFurnitureLayout(
  spaceId: number,
  roomId: number,
  layoutId: number,
  name: string,
  items: FurnitureItem[],
): Promise<FurnitureLayout> {
  const { data } = await apiClient.put<ApiResponse<FurnitureLayout>>(
    `/spaces/${spaceId}/rooms/${roomId}/layouts/${layoutId}`,
    { name, items },
  );
  return data.data;
}

export async function deleteMyFurnitureLayout(spaceId: number, roomId: number, layoutId: number): Promise<void> {
  await apiClient.delete(`/spaces/${spaceId}/rooms/${roomId}/layouts/${layoutId}`);
}

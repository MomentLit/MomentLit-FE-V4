import { apiClient, publicApiClient } from "@/shared/api/client";
import type { ApiResponse } from "@/shared/api/types";
import type {
  CustomFurniture,
  CustomFurnitureMount,
  FurnitureItem,
  FurnitureLayout,
  LayoutJob,
  PlanDetection,
  Room,
  RoomUpsertRequest,
} from "./model";

/** 360° 사진에서 방 모서리 찾기를 시작한다 — 결과는 `fetchLayoutJob`으로 폴링한다. 대기열이 가득 차면 503. */
export async function createLayoutJob(imageUrl: string): Promise<LayoutJob> {
  const { data } = await apiClient.post<ApiResponse<LayoutJob>>("/rooms/layout-jobs", { image_url: imageUrl });
  return data.data;
}

export async function fetchLayoutJob(jobId: string, signal?: AbortSignal): Promise<LayoutJob> {
  const { data } = await apiClient.get<ApiResponse<LayoutJob>>(`/rooms/layout-jobs/${jobId}`, { signal });
  return data.data;
}

export async function detectPlanWalls(imageUrl: string, metersPerPixel?: number): Promise<PlanDetection> {
  const { data } = await apiClient.post<ApiResponse<PlanDetection>>("/rooms/plan-detect", {
    image_url: imageUrl,
    meters_per_pixel: metersPerPixel,
  }, { timeout: 25_000 });
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

// ---------- 내 가구 ----------

/** 내 가구 목록(최근순). 사진 생성 중이면 status PROCESSING — READY/FAILED가 될 때까지 다시 부른다. */
export async function fetchMyFurniture(): Promise<CustomFurniture[]> {
  const { data } = await apiClient.get<ApiResponse<CustomFurniture[]>>("/rooms/furniture");
  return data.data;
}

export interface CreateFurnitureFromPhotoRequest {
  name: string;
  mount: CustomFurnitureMount;
  /** 실제 높이(m). 폭·깊이는 선택. */
  height: number;
  width?: number;
  depth?: number;
  front: File;
  side?: File | null;
}

/** 사진으로 내 가구 만들기 — 바로 PROCESSING으로 돌아오고, 서버가 2분쯤 걸려 만든다. 하루 5번, 대기열이 가득하면 503. */
export async function createFurnitureFromPhoto(request: CreateFurnitureFromPhotoRequest): Promise<CustomFurniture> {
  const form = new FormData();
  form.append("name", request.name);
  form.append("mount", request.mount);
  form.append("height", String(request.height));
  if (request.width) form.append("width", String(request.width));
  if (request.depth) form.append("depth", String(request.depth));
  form.append("front", request.front);
  if (request.side) form.append("side", request.side);
  const { data } = await apiClient.post<ApiResponse<CustomFurniture>>("/rooms/furniture/photo", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data.data;
}

export interface CreateFurnitureFromFileRequest {
  name: string;
  mount: CustomFurnitureMount;
  width: number;
  depth: number;
  height: number;
  /** 바닥 가운데 원점·앞 +z·실제 크기(m)로 맞춘 GLB. */
  model: Blob;
  /** 미리보기에서 찍은 PNG. */
  thumbnail: Blob;
}

/** GLB 파일로 내 가구 올리기(30MB까지) — 바로 READY. */
export async function createFurnitureFromFile(request: CreateFurnitureFromFileRequest): Promise<CustomFurniture> {
  const form = new FormData();
  form.append("name", request.name);
  form.append("mount", request.mount);
  form.append("width", String(request.width));
  form.append("depth", String(request.depth));
  form.append("height", String(request.height));
  form.append("model", request.model, "model.glb");
  form.append("thumbnail", request.thumbnail, "thumbnail.png");
  const { data } = await apiClient.post<ApiResponse<CustomFurniture>>("/rooms/furniture/file", form, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 120_000,
  });
  return data.data;
}

export async function updateMyFurniture(id: number, request: { name?: string; mount?: CustomFurnitureMount }): Promise<CustomFurniture> {
  const { data } = await apiClient.patch<ApiResponse<CustomFurniture>>(`/rooms/furniture/${id}`, request);
  return data.data;
}

export async function deleteMyFurniture(id: number): Promise<void> {
  await apiClient.delete(`/rooms/furniture/${id}`);
}

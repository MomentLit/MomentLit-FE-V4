/**
 * 3D 방 — 백엔드 `modules/room` 계약(BE-V2 `docs/room-api.md`).
 * 좌표는 모두 미터 단위 바닥 평면 `[x, z]`. 파노라마 방은 사진을 찍은 자리가 원점이다.
 */

/** `[x, z]` 미터. */
export type FloorPoint = [number, number];

/** `[u, v]` 0~1 — 등장방형 사진 위 위치(왼쪽 위가 0,0). */
export type PanoramaUv = [number, number];

export type RoomSource = "PANORAMA" | "PLAN";

export interface RoomGeometry {
  /** 바깥벽 꼭짓점, 벽 순서대로(첫 점을 반복하지 않는다). */
  outer: FloorPoint[];
  /** 안쪽 벽 선분 목록. 파노라마 방은 비어 있다. */
  inner: [FloorPoint, FloorPoint][];
  /** 사진을 찍은 자리 — 벽에 사진을 입히는 기준점. */
  camera: FloorPoint | null;
  /** 사진 가로 회전 보정(라디안). */
  yaw: number | null;
  /** 바닥 모서리의 사진 좌표 — 다시 편집할 때 쓴다. */
  corners: PanoramaUv[] | null;
}

export interface Room {
  space_id: number;
  scene_id: number | null;
  source: RoomSource;
  /** 벽·바닥에 입힐 사진 — 자동 인식을 거쳤으면 수평을 맞춘 사진. */
  image_url: string | null;
  ceiling_height: number;
  camera_height: number | null;
  area_m2: number;
  area_pyeong: number;
  geometry: RoomGeometry;
  updated_at: string;
}

export interface RoomUpsertRequest {
  scene_id?: number | null;
  source: RoomSource;
  image_url: string;
  ceiling_height: number;
  camera_height: number;
  geometry: RoomGeometry;
}

export type LayoutJobStatus = "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";

export interface LayoutJobResult {
  /** 수평을 맞춘 사진. `uv`는 이 사진 기준이다. */
  image_url: string;
  /** (천장, 바닥) 쌍이 번갈아 나오는 0~1 좌표. */
  uv: PanoramaUv[];
  /** 카메라→천장 거리(임의 단위). */
  z0: number;
  /** 카메라→바닥 거리(같은 단위, 음수). */
  z1: number;
  aligned: boolean;
}

export interface LayoutJob {
  job_id: string;
  status: LayoutJobStatus;
  result: LayoutJobResult | null;
  error: string | null;
}

export interface FurnitureItem {
  /** 프론트 가구 목록의 id(예: `sofa-3`). */
  type: string;
  /** 가구 중심 `[x, z]` 미터. */
  x: number;
  z: number;
  /** y축 회전(라디안). */
  rotation: number;
}

export interface FurnitureLayout {
  space_id: number;
  items: FurnitureItem[];
  updated_at: string;
}

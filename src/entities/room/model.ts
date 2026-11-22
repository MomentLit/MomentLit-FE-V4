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
  /** 도면 방의 도면 이미지 놓는 자리(축척·위치). 파노라마 방은 없다. */
  plan?: PlanImage | null;
}

/** 도면 이미지를 바닥 평면(m)에 놓는 자리. */
export interface PlanImage {
  /** 축척: 이미지 1px = 몇 m. */
  meters_per_pixel: number;
  /** 이미지 왼쪽 위 모서리의 바닥 좌표 [x, z] (m). */
  offset: FloorPoint;
  width_px: number;
  height_px: number;
  /** 3D 바닥에 도면을 깔지. */
  show_floor: boolean;
}

/** 도면 방은 장면 방 뒤에 오도록 순서를 이만큼 띄운다. */
export const PLAN_ROOM_SORT_BASE = 1000;

/** 공간의 3D 방 하나 — 360° 장면마다 하나씩, 공간당 20개까지. */
export interface Room {
  room_id: number;
  space_id: number;
  /** 방 이름 — 보통 장면 이름. */
  name: string;
  /** 3D 보기 탭 순서 — 보통 장면 순서. */
  sort_order: number;
  /** 이 방을 만든 360° 장면의 사진. 장면 id는 공간 수정 때 바뀔 수 있어 사진 URL로 장면과 짝짓는다. */
  scene_image_url: string | null;
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

export const MAX_ROOMS_PER_SPACE = 20;

export interface RoomUpsertRequest {
  name: string;
  sort_order: number;
  scene_image_url: string | null;
  source: RoomSource;
  image_url: string;
  ceiling_height: number;
  /** 파노라마 방은 필수, 도면 방은 null. */
  camera_height: number | null;
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

export type PlanDetection =
  | { ok: true; width: number; height: number; outer: [number, number][]; inner: [[number, number], [number, number]][] }
  | { ok: false; reason: string | null };

export interface FurnitureItem {
  /** 프론트 가구 목록의 id(예: `sofa-3`). */
  type: string;
  /** 가구 중심 `[x, z]` 미터. */
  x: number;
  z: number;
  /** y축 회전(라디안). */
  rotation: number;
  /**
   * 바닥에서 가구 밑면까지 높이(m). 없으면 0(바닥). 가구 위에 올린 소품·벽에 건 액자·천장 조명에 쓴다.
   * 예전에 저장한 배치에는 없거나 null이다.
   */
  y?: number | null;
}

/** 로그인한 사용자가 방마다 이름 붙여 저장한 배치. 방마다 20개까지. */
export interface FurnitureLayout {
  layout_id: number;
  room_id: number;
  space_id: number;
  name: string;
  items: FurnitureItem[];
  updated_at: string;
}

export const MAX_FURNITURE_LAYOUTS = 20;

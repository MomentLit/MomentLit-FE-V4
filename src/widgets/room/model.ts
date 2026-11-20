import type { PanoramaUv, Room, RoomUpsertRequest } from "@/entities/room";
import type { PanoramaTourScene } from "@/widgets/panorama/model";
import {
  cameraHeightFromCeiling,
  ceilingFromCameraHeight,
  outerFromCorners,
  polygonArea,
  round,
  toPyeong,
  wallLengths,
  type Vec2,
} from "./lib/geometry";

export const DEFAULT_CEILING_HEIGHT = 2.4;
export const DEFAULT_CAMERA_HEIGHT = 1.5;
export const MIN_CEILING_HEIGHT = 1.8;
export const MAX_CEILING_HEIGHT = 6;
export const MIN_CAMERA_HEIGHT = 0.3;
export const MAX_CAMERA_HEIGHT = 2.5;
/** 서버의 최소 면적과 같다. */
const MIN_AREA_M2 = 0.5;

/**
 * 호스트가 만드는 중인(또는 저장된) 파노라마 방. 바닥 모서리를 사진 좌표로 들고 있다가
 * 저장할 때 촬영 높이로 미터 좌표를 계산한다 — 높이를 바꿔도 모서리를 다시 찍을 필요가 없다.
 */
export interface RoomDraft {
  /** 이 방을 만든 360° 장면의 사진 — 장면과 방을 짝짓는 열쇠(장면마다 방 하나). */
  sceneImageUrl: string;
  /** 저장된 방이면 그 id(수정 화면), 아직 저장 안 했으면 null. */
  roomId: number | null;
  /** 벽에 입힐 사진. 자동 인식을 거쳤으면 수평을 맞춘 사진(모서리 좌표가 이 사진 기준). */
  imageUrl: string;
  /** 바닥 모서리, 벽 순서대로. */
  corners: PanoramaUv[];
  ceilingHeight: number;
  cameraHeight: number;
  /**
   * 자동 인식의 천장·바닥 거리 비율. 있으면 천장 높이 하나로 촬영 높이가 정해진다(서로 연동).
   * 수동으로 찍었거나 저장된 방을 다시 열면 없다.
   */
  layoutRatio: { z0: number; z1: number } | null;
}

/** 장면 사진으로 새 방 초안을 만든다. 처음에는 그 사진에 모서리를 찍는다. */
export function createRoomDraft(sceneImageUrl: string): RoomDraft {
  return {
    sceneImageUrl,
    roomId: null,
    imageUrl: sceneImageUrl,
    corners: [],
    ceilingHeight: DEFAULT_CEILING_HEIGHT,
    cameraHeight: DEFAULT_CAMERA_HEIGHT,
    layoutRatio: null,
  };
}

/** 천장 높이를 바꾼다 — 자동 인식 비율이 있으면 촬영 높이도 같이 맞춘다. */
export function withCeilingHeight(draft: RoomDraft, ceilingHeight: number): RoomDraft {
  const ceiling = round(ceilingHeight, 2);
  if (!draft.layoutRatio) return { ...draft, ceilingHeight: ceiling };
  const { z0, z1 } = draft.layoutRatio;
  return { ...draft, ceilingHeight: ceiling, cameraHeight: round(cameraHeightFromCeiling(ceiling, z0, z1), 2) };
}

/** 촬영 높이를 바꾼다 — 자동 인식 비율이 있으면 천장 높이도 같이 맞춘다. */
export function withCameraHeight(draft: RoomDraft, cameraHeight: number): RoomDraft {
  const camera = round(cameraHeight, 2);
  if (!draft.layoutRatio) return { ...draft, cameraHeight: camera };
  const { z0, z1 } = draft.layoutRatio;
  return { ...draft, cameraHeight: camera, ceilingHeight: round(ceilingFromCameraHeight(camera, z0, z1), 2) };
}

export interface RoomSummary {
  outer: Vec2[];
  areaM2: number;
  areaPyeong: number;
  wallLengths: number[];
}

/** 모서리가 3개 이상이고 모두 바닥이면 평면을 계산한다. */
export function summarizeRoom(draft: RoomDraft): RoomSummary | null {
  if (draft.corners.length < 3) return null;
  const outer = outerFromCorners(draft.corners, draft.cameraHeight);
  if (!outer) return null;
  const areaM2 = polygonArea(outer);
  return { outer, areaM2, areaPyeong: toPyeong(areaM2), wallLengths: wallLengths(outer) };
}

/** 저장할 수 없는 이유. 저장할 수 있으면 null. */
export function validateRoomDraft(draft: RoomDraft): string | null {
  if (draft.corners.length < 3) return "바닥 모서리를 3개 이상 찍어 주세요.";
  if (!(draft.ceilingHeight >= MIN_CEILING_HEIGHT && draft.ceilingHeight <= MAX_CEILING_HEIGHT)) {
    return `천장 높이는 ${MIN_CEILING_HEIGHT}~${MAX_CEILING_HEIGHT}m로 입력해 주세요.`;
  }
  if (!(draft.cameraHeight >= MIN_CAMERA_HEIGHT && draft.cameraHeight <= MAX_CAMERA_HEIGHT)) {
    return `촬영 높이는 ${MIN_CAMERA_HEIGHT}~${MAX_CAMERA_HEIGHT}m로 입력해 주세요.`;
  }
  if (draft.cameraHeight >= draft.ceilingHeight) return "촬영 높이는 천장 높이보다 낮아야 해요.";
  const summary = summarizeRoom(draft);
  if (!summary) return "바닥과 벽이 만나는 모서리만 찍어 주세요.";
  if (summary.areaM2 < MIN_AREA_M2) return "방이 너무 작아요. 모서리를 다시 확인해 주세요.";
  return null;
}

/** 저장 요청. `validateRoomDraft`를 통과한 초안만 넘긴다. 이름·순서는 지금 장면 목록에서 정한다(`roomPlacement`). */
export function toRoomRequest(draft: RoomDraft, placement: { name: string; sortOrder: number }): RoomUpsertRequest {
  const summary = summarizeRoom(draft);
  if (!summary) throw new Error("저장할 수 없는 방이에요.");
  return {
    name: placement.name,
    sort_order: placement.sortOrder,
    scene_image_url: draft.sceneImageUrl,
    source: "PANORAMA",
    image_url: draft.imageUrl,
    ceiling_height: draft.ceilingHeight,
    camera_height: draft.cameraHeight,
    geometry: {
      outer: summary.outer.map(([x, z]) => [round(x), round(z)]),
      inner: [],
      camera: [0, 0],
      yaw: 0,
      corners: draft.corners.map(([u, v]) => [round(u, 5), round(v, 5)]),
    },
  };
}

/** 저장된 방 → 다시 편집할 초안. 모서리 사진 좌표가 없는(도면) 방이면 null. */
export function roomToDraft(room: Room): RoomDraft | null {
  if (room.source !== "PANORAMA" || !room.image_url || !room.geometry.corners || room.camera_height == null) return null;
  return {
    sceneImageUrl: room.scene_image_url ?? room.image_url,
    roomId: room.room_id,
    imageUrl: room.image_url,
    corners: room.geometry.corners.map(([u, v]) => [u, v]),
    ceilingHeight: room.ceiling_height,
    cameraHeight: room.camera_height,
    layoutRatio: null,
  };
}

export function isSameRoomDraft(a: RoomDraft | null, b: RoomDraft | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.sceneImageUrl === b.sceneImageUrl &&
    a.roomId === b.roomId &&
    a.imageUrl === b.imageUrl &&
    a.ceilingHeight === b.ceilingHeight &&
    a.cameraHeight === b.cameraHeight &&
    JSON.stringify(a.corners) === JSON.stringify(b.corners)
  );
}

/** 장면 → 방 이름·순서. 장면 이름이 없으면 "장면 n". */
export function roomPlacement(scenes: readonly PanoramaTourScene[], sceneImageUrl: string): { name: string; sortOrder: number } {
  const index = scenes.findIndex((scene) => scene.image_url === sceneImageUrl);
  const name = index >= 0 ? scenes[index].name?.trim() : "";
  return { name: name || `장면 ${index >= 0 ? index + 1 : 1}`, sortOrder: Math.max(0, index) };
}

/** 지금 장면에 남아 있는 방만 — 장면을 지우거나 사진을 바꾸면 그 장면으로 만든 방도 뺀다. */
export function keepRoomsForScenes(rooms: readonly RoomDraft[], scenes: readonly PanoramaTourScene[]): RoomDraft[] {
  const urls = new Set(scenes.map((scene) => scene.image_url));
  return rooms.filter((room) => urls.has(room.sceneImageUrl));
}

/** 장면 하나의 방을 넣거나(바꾸거나) 뺀다. */
export function setRoomForScene(rooms: readonly RoomDraft[], sceneImageUrl: string, room: RoomDraft | null): RoomDraft[] {
  const others = rooms.filter((item) => item.sceneImageUrl !== sceneImageUrl);
  return room ? [...others, room] : others;
}

export interface RoomSavePlan {
  create: RoomUpsertRequest[];
  update: { roomId: number; request: RoomUpsertRequest }[];
  remove: number[];
}

/**
 * 수정 화면 저장 — 지금 방 초안들과 서버에 저장된 방들을 비교해 만들기·덮어쓰기·지우기를 정한다.
 * 장면 이름·순서가 바뀐 것도 덮어쓰기로 반영한다. 다시 편집할 수 없는(도면) 방은 건드리지 않는다.
 */
export function planRoomSaves(
  drafts: readonly RoomDraft[],
  saved: readonly Room[],
  scenes: readonly PanoramaTourScene[],
): RoomSavePlan {
  const plan: RoomSavePlan = { create: [], update: [], remove: [] };
  const keptIds = new Set<number>();

  for (const draft of drafts) {
    const request = toRoomRequest(draft, roomPlacement(scenes, draft.sceneImageUrl));
    const original = draft.roomId !== null ? saved.find((room) => room.room_id === draft.roomId) : undefined;
    if (!original) {
      plan.create.push(request);
      continue;
    }
    keptIds.add(original.room_id);
    const originalDraft = roomToDraft(original);
    const originalRequest = originalDraft
      ? toRoomRequest(originalDraft, { name: original.name, sortOrder: original.sort_order })
      : null;
    if (JSON.stringify(request) !== JSON.stringify(originalRequest)) {
      plan.update.push({ roomId: original.room_id, request });
    }
  }

  for (const room of saved) {
    if (!keptIds.has(room.room_id) && roomToDraft(room)) plan.remove.push(room.room_id);
  }
  return plan;
}

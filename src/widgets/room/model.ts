import type { PanoramaUv, Room, RoomUpsertRequest } from "@/entities/room";
import type { PanoramaTourScene } from "@/widgets/panorama/model";
import {
  cameraHeightFromCeiling,
  floorPointFromUv,
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
/** 서버의 좌표 상한(m)과 같다. */
const MAX_COORDINATE = 100;

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
  /**
   * 가로 축척(m) — 실측 벽 길이로 정한 값. 사진 속 바닥 좌표(촬영 높이 1 기준)에 곱하면 실제 m가 된다.
   * null이면 아직 실측으로 맞추지 않아 촬영 높이를 따라간다. 정해진 뒤엔 천장·촬영 높이를 바꿔도 바닥 크기는 그대로다.
   */
  planScale: number | null;
  /** 호스트가 천장을 맞췄는지(사진에서 천장 모서리를 찍었거나 천장 높이를 넣었는지) — 저장하려면 필요하다. */
  ceilingConfirmed: boolean;
  /**
   * 안쪽 벽(도면에서 그린 칸막이). 가로 축척을 1로 본 바닥 좌표 — 바깥벽(모서리 사진 좌표)처럼 축척을 바꾸면
   * 같은 비율로 커지고 작아진다. 실제 m는 `summarizeRoom().inner`.
   */
  inner: [Vec2, Vec2][];
}

/** 바닥 좌표의 가로 축척 — 실측으로 맞췄으면 그 값, 아니면 촬영 높이. */
export function planScaleOf(draft: RoomDraft): number {
  return draft.planScale ?? draft.cameraHeight;
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
    planScale: null,
    ceilingConfirmed: false,
    inner: [],
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

/**
 * 실측 벽 길이로 바닥 크기(가로 축척)만 맞춘다. 천장·촬영 높이는 건드리지 않는다 — 높이는 그다음 천장 높이로 따로 맞춘다.
 * 사진은 그만큼 세로로 늘여 입힌다.
 */
export function scaleRoomFromWall(draft: RoomDraft, currentLength: number, actualLength: number):
  { draft: RoomDraft; error?: never } | { draft?: never; error: string } {
  if (!Number.isFinite(currentLength) || currentLength <= 0 || !Number.isFinite(actualLength) || actualLength <= 0) {
    return { error: "기준으로 쓸 벽과 실제 길이를 다시 확인해 주세요." };
  }
  const next: RoomDraft = { ...draft, planScale: planScaleOf(draft) * (actualLength / currentLength) };
  const summary = summarizeRoom(next);
  if (!summary) return { error: "바닥과 벽이 만나는 모서리만 찍어 주세요." };
  const far = Math.max(...summary.outer.flat().map(Math.abs), ...summary.inner.flat(2).map(Math.abs));
  if (far > MAX_COORDINATE) {
    return {
      error: `이 길이로 맞추면 방이 사진 찍은 자리에서 ${MAX_COORDINATE}m 넘게 뻗어요. 고른 벽과 실측 길이(m)가 맞는지, 모서리가 지평선 가까이 찍히지 않았는지 확인해 주세요.`,
    };
  }
  return { draft: next };
}

export interface RoomSummary {
  outer: Vec2[];
  /** 안쪽 벽(m). */
  inner: [Vec2, Vec2][];
  areaM2: number;
  areaPyeong: number;
  wallLengths: number[];
}

/** 모서리가 3개 이상이고 모두 바닥이면 평면을 계산한다. */
export function summarizeRoom(draft: RoomDraft): RoomSummary | null {
  if (draft.corners.length < 3) return null;
  const k = planScaleOf(draft);
  const outer = outerFromCorners(draft.corners, k);
  if (!outer) return null;
  const areaM2 = polygonArea(outer);
  const inner = draft.inner.map(([a, b]) => [[a[0] * k, a[1] * k], [b[0] * k, b[1] * k]] as [Vec2, Vec2]);
  return { outer, inner, areaM2, areaPyeong: toPyeong(areaM2), wallLengths: wallLengths(outer) };
}

/** 저장할 수 없는 이유. 저장할 수 있으면 null. */
export function validateRoomDraft(draft: RoomDraft): string | null {
  if (draft.corners.length < 3) return "바닥 모서리를 3개 이상 찍어 주세요.";
  if (draft.planScale === null) return "‘도면’에서 실제로 잰 벽 하나의 길이를 넣어 방 크기를 맞춰 주세요.";
  if (!draft.ceilingConfirmed) return "‘천장 맞추기’로 사진에서 천장 모서리 하나를 찍어 주세요.";
  if (!(draft.ceilingHeight >= MIN_CEILING_HEIGHT && draft.ceilingHeight <= MAX_CEILING_HEIGHT)) {
    return `천장 높이는 ${MIN_CEILING_HEIGHT}~${MAX_CEILING_HEIGHT}m로 입력해 주세요.`;
  }
  if (!(draft.cameraHeight >= MIN_CAMERA_HEIGHT && draft.cameraHeight <= MAX_CAMERA_HEIGHT)) {
    return `촬영 높이는 ${MIN_CAMERA_HEIGHT}~${MAX_CAMERA_HEIGHT}m로 입력해 주세요.`;
  }
  if (draft.cameraHeight >= draft.ceilingHeight) return "촬영 높이는 천장 높이보다 낮아야 해요.";
  if (draft.planScale <= 0) return "방 크기를 다시 맞춰 주세요.";
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
      inner: summary.inner.map(([a, b]) => [[round(a[0]), round(a[1])], [round(b[0]), round(b[1])]]),
      camera: [0, 0],
      yaw: 0,
      corners: draft.corners.map(([u, v]) => [round(u, 5), round(v, 5)]),
    },
  };
}

/** 저장된 방 → 다시 편집할 초안. 모서리 사진 좌표가 없는(도면) 방이면 null. */
export function roomToDraft(room: Room): RoomDraft | null {
  if (room.source !== "PANORAMA" || !room.image_url || !room.geometry.corners || room.camera_height == null) return null;
  const scale = savedPlanScale(room.geometry.outer, room.geometry.corners) ?? room.camera_height;
  return {
    sceneImageUrl: room.scene_image_url ?? room.image_url,
    roomId: room.room_id,
    imageUrl: room.image_url,
    corners: room.geometry.corners.map(([u, v]) => [u, v]),
    ceilingHeight: room.ceiling_height,
    cameraHeight: room.camera_height,
    layoutRatio: null,
    planScale: scale,
    ceilingConfirmed: true,
    inner: innerToRelative(room.geometry.inner ?? [], scale),
  };
}

/**
 * 저장된 바깥벽(m)과 모서리 사진 좌표 → 가로 축척. 실측으로 맞춘 방은 촬영 높이와 다르다.
 * 사진 속 좌표(촬영 높이 1)의 길이 합과 저장된 길이 합의 비율로 구한다. 못 구하면 null.
 */
export function savedPlanScale(outer: readonly (readonly number[])[], corners: readonly (readonly number[])[]): number | null {
  if (outer.length !== corners.length || outer.length === 0) return null;
  let saved = 0;
  let unit = 0;
  for (let i = 0; i < outer.length; i++) {
    const point = floorPointFromUv([corners[i][0], corners[i][1]], 1);
    if (!point) return null;
    saved += Math.hypot(outer[i][0], outer[i][1]);
    unit += Math.hypot(point[0], point[1]);
  }
  return unit > 0 && saved > 0 ? saved / unit : null;
}

/** 도면에서 그린 안쪽 벽(m) → 초안에 넣을 값(가로 축척 1 기준). */
export function innerToRelative(inner: readonly (readonly (readonly number[])[])[], scale: number): [Vec2, Vec2][] {
  return inner.map(([a, b]) => [[a[0] / scale, a[1] / scale], [b[0] / scale, b[1] / scale]]);
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
    a.planScale === b.planScale &&
    JSON.stringify(a.corners) === JSON.stringify(b.corners) &&
    JSON.stringify(a.inner) === JSON.stringify(b.inner)
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

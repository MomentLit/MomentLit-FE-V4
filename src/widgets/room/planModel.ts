import { PLAN_ROOM_SORT_BASE, type PlanDetection, type Room, type RoomUpsertRequest } from "@/entities/room";
import { centroid, polygonArea, round, toPyeong, wallLengths, type Vec2 } from "./lib/geometry";
import type { Segment } from "./lib/planEdit";
import { DEFAULT_CEILING_HEIGHT, MAX_CEILING_HEIGHT, MIN_CEILING_HEIGHT } from "./model";

/** 축척을 모를 때 쓰는 임시 축척 — 1px = 1cm. 기준 길이를 재면 바뀐다. */
const PROVISIONAL_METERS_PER_PIXEL = 0.01;
const MIN_AREA_M2 = 0.5;

/**
 * 도면 이미지로 만드는 중인(또는 저장된) 방. 점은 모두 바닥 평면(m)이고, 도면 이미지는 `offset`(왼쪽 위)부터
 * `metersPerPixel` 축척으로 깔린다. 축척을 바꾸면 이미지·점이 원점 기준으로 함께 커지거나 줄어 모양이 그대로 유지된다.
 */
export interface PlanDraft {
  /** 저장된 방이면 그 id, 새 방이면 null. */
  roomId: number | null;
  name: string;
  imageUrl: string;
  widthPx: number;
  heightPx: number;
  metersPerPixel: number;
  /** 이미지 왼쪽 위 모서리의 바닥 좌표 [x, z]. */
  offset: Vec2;
  /** 기준 길이로 축척을 맞췄는지. 아직이면 벽 길이를 넣을 때 그 길이로 축척을 맞춘다. */
  calibrated: boolean;
  outer: Vec2[];
  /** 바깥벽을 닫았는지(첫 점을 다시 눌렀는지). */
  closed: boolean;
  inner: Segment[];
  ceilingHeight: number;
  showFloor: boolean;
}

/** 도면 이미지를 원점 가운데에 놓고 시작한다. */
export function createPlanDraft(imageUrl: string, widthPx: number, heightPx: number, name: string): PlanDraft {
  const mpp = PROVISIONAL_METERS_PER_PIXEL;
  return {
    roomId: null,
    name,
    imageUrl,
    widthPx,
    heightPx,
    metersPerPixel: mpp,
    offset: [-(widthPx * mpp) / 2, -(heightPx * mpp) / 2],
    calibrated: false,
    outer: [],
    closed: false,
    inner: [],
    ceilingHeight: DEFAULT_CEILING_HEIGHT,
    showFloor: true,
  };
}

/** 원점 기준으로 k배 — 축척·이미지 위치·벽 점이 함께 바뀌어 도면 위의 벽은 그 자리에 남는다. */
export function scalePlan(draft: PlanDraft, k: number): PlanDraft {
  const s = (p: Vec2): Vec2 => [p[0] * k, p[1] * k];
  return {
    ...draft,
    metersPerPixel: draft.metersPerPixel * k,
    offset: s(draft.offset),
    outer: draft.outer.map(s),
    inner: draft.inner.map(([a, b]) => [s(a), s(b)] as Segment),
  };
}

/** 지금 길이가 `current`m인 구간을 실제로는 `actual`m로 보고 도면 전체 축척을 맞춘다. */
export function calibratePlan(draft: PlanDraft, current: number, actual: number): PlanDraft {
  if (!(current > 0) || !(actual > 0)) return draft;
  return { ...scalePlan(draft, actual / current), calibrated: true };
}

export function applyDetectedWalls(draft: PlanDraft, detection: Extract<PlanDetection, { ok: true }>): PlanDraft | null {
  if (detection.width !== draft.widthPx || detection.height !== draft.heightPx || detection.outer.length < 3) return null;
  const toMeters = ([x, y]: Vec2): Vec2 => [
    draft.offset[0] + x * draft.metersPerPixel,
    draft.offset[1] + y * draft.metersPerPixel,
  ];
  return {
    ...draft,
    outer: detection.outer.map(toMeters),
    inner: detection.inner.map(([start, end]) => [toMeters(start), toMeters(end)]),
    closed: true,
  };
}

/** 1m가 도면 몇 px인지 — 화면 안내용. */
export function pixelsPerMeter(draft: PlanDraft): number {
  return 1 / draft.metersPerPixel;
}

export interface PlanSummary {
  areaM2: number;
  areaPyeong: number;
  wallLengths: number[];
}

export function summarizePlan(draft: PlanDraft): PlanSummary | null {
  if (!draft.closed || draft.outer.length < 3) return null;
  const areaM2 = polygonArea(draft.outer);
  return { areaM2, areaPyeong: toPyeong(areaM2), wallLengths: wallLengths(draft.outer) };
}

/** 저장할 수 없는 이유. 저장할 수 있으면 null. */
export function validatePlanDraft(draft: PlanDraft): string | null {
  if (!draft.name.trim()) return "방 이름을 넣어 주세요.";
  if (!draft.calibrated) return "기준 길이를 재서 축척을 먼저 맞춰 주세요.";
  if (!draft.closed || draft.outer.length < 3) return "바깥벽을 그리고 첫 점을 다시 눌러 닫아 주세요.";
  if (!(draft.ceilingHeight >= MIN_CEILING_HEIGHT && draft.ceilingHeight <= MAX_CEILING_HEIGHT)) {
    return `천장 높이는 ${MIN_CEILING_HEIGHT}~${MAX_CEILING_HEIGHT}m로 입력해 주세요.`;
  }
  if (polygonArea(draft.outer) < MIN_AREA_M2) return "방이 너무 작아요. 축척과 바깥벽을 다시 확인해 주세요.";
  return null;
}

/**
 * 저장 요청. 원점이 방 가운데에 오도록 옮겨서 보낸다(1인칭·미니어처가 방 가운데를 기준으로 잡히게).
 * `validatePlanDraft`를 통과한 초안만 넘긴다.
 */
export function toPlanRoomRequest(draft: PlanDraft, sortOrder: number): RoomUpsertRequest {
  const [cx, cz] = centroid(draft.outer);
  const move = ([x, z]: Vec2): [number, number] => [round(x - cx), round(z - cz)];
  return {
    name: draft.name.trim(),
    sort_order: sortOrder,
    scene_image_url: null,
    source: "PLAN",
    image_url: draft.imageUrl,
    ceiling_height: round(draft.ceilingHeight, 2),
    camera_height: null,
    geometry: {
      outer: draft.outer.map(move),
      inner: draft.inner.map(([a, b]) => [move(a), move(b)]),
      camera: null,
      yaw: null,
      corners: null,
      plan: {
        meters_per_pixel: draft.metersPerPixel,
        offset: move(draft.offset),
        width_px: draft.widthPx,
        height_px: draft.heightPx,
        show_floor: draft.showFloor,
      },
    },
  };
}

/** 새 도면 방의 순서 — 장면 방 뒤, 이미 있는 도면 방 다음. */
export function nextPlanSortOrder(rooms: readonly Room[]): number {
  const planOrders = rooms.filter((room) => room.source === "PLAN").map((room) => room.sort_order);
  return planOrders.length > 0 ? Math.max(...planOrders) + 1 : PLAN_ROOM_SORT_BASE;
}

/** 저장된 도면 방 → 다시 편집할 초안. 도면 정보가 없으면 null. */
export function roomToPlanDraft(room: Room): PlanDraft | null {
  const plan = room.geometry.plan;
  if (room.source !== "PLAN" || !plan || !room.image_url) return null;
  return {
    roomId: room.room_id,
    name: room.name,
    imageUrl: room.image_url,
    widthPx: plan.width_px,
    heightPx: plan.height_px,
    metersPerPixel: plan.meters_per_pixel,
    offset: [plan.offset[0], plan.offset[1]],
    calibrated: true,
    outer: room.geometry.outer.map(([x, z]) => [x, z]),
    closed: true,
    inner: room.geometry.inner.map(([a, b]) => [[a[0], a[1]], [b[0], b[1]]] as Segment),
    ceilingHeight: room.ceiling_height,
    showFloor: plan.show_floor,
  };
}

/** 3D·도면 보기에서 바닥에 깔 도면 이미지 자리(m). */
export interface PlanFloorImage {
  url: string;
  x: number;
  z: number;
  width: number;
  height: number;
}

export function planFloorImage(draft: Pick<PlanDraft, "imageUrl" | "offset" | "widthPx" | "heightPx" | "metersPerPixel">): PlanFloorImage {
  return {
    url: draft.imageUrl,
    x: draft.offset[0],
    z: draft.offset[1],
    width: draft.widthPx * draft.metersPerPixel,
    height: draft.heightPx * draft.metersPerPixel,
  };
}

/** 저장된 방의 도면 이미지 자리. 도면 방이 아니면 null. */
export function roomPlanFloorImage(room: Room): PlanFloorImage | null {
  const plan = room.geometry.plan;
  if (room.source !== "PLAN" || !plan || !room.image_url) return null;
  return planFloorImage({
    imageUrl: room.image_url,
    offset: plan.offset,
    widthPx: plan.width_px,
    heightPx: plan.height_px,
    metersPerPixel: plan.meters_per_pixel,
  });
}

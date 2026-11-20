import { centroid, pointInPolygon, segmentDistance, type Vec2 } from "./geometry";

/** 1인칭 — 눈높이, 몸 반지름, 걷기·뛰기 속도(m/s). */
export const EYE_HEIGHT = 1.6;
export const BODY_RADIUS = 0.22;
export const WALK_SPEED = 1.4;
export const RUN_SPEED = 3;

export interface WalkArea {
  outer: readonly Vec2[];
  inner: readonly (readonly [Vec2, Vec2])[];
}

/** 눈높이(바닥 기준) — 천장이 낮으면 천장에서 30cm 아래. */
export function eyeHeight(ceilingHeight: number): number {
  return Math.min(EYE_HEIGHT, ceilingHeight - 0.3);
}

/** 그 자리에 설 수 있는지 — 방 안이고, 바깥벽·안쪽 벽에 몸이 닿지 않아야 한다. */
export function canStand([x, z]: Vec2, { outer, inner }: WalkArea): boolean {
  if (outer.length < 3 || !pointInPolygon([x, z], outer)) return false;
  for (let i = 0; i < outer.length; i++) {
    if (segmentDistance([x, z], outer[i], outer[(i + 1) % outer.length]) < BODY_RADIUS) return false;
  }
  for (const [a, b] of inner) {
    if (segmentDistance([x, z], a, b) < BODY_RADIUS + 0.05) return false;
  }
  return true;
}

/**
 * 한 걸음 옮기기. 막히면 x·z 한쪽으로만 가 본다 — 벽에 비스듬히 부딪히면 벽을 따라 미끄러진다.
 * 움직이지 못하면 null.
 */
export function step(position: Vec2, dx: number, dz: number, area: WalkArea): Vec2 | null {
  const [x, z] = position;
  if (canStand([x + dx, z + dz], area)) return [x + dx, z + dz];
  if (dx && canStand([x + dx, z], area)) return [x + dx, z];
  if (dz && canStand([x, z + dz], area)) return [x, z + dz];
  return null;
}

/**
 * 시작 위치 — 파노라마 방은 사진 찍은 자리, 아니면 무게중심. 벽에 걸리면 둘레를 넓혀 가며 설 수 있는 곳을 찾는다.
 */
export function startPosition(area: WalkArea, preferred: Vec2 | null): Vec2 | null {
  const center = preferred ?? centroid(area.outer);
  if (canStand(center, area)) return center;
  for (let radius = 0.25; radius < 15; radius += 0.25) {
    for (let i = 0; i < 24; i++) {
      const angle = (i * Math.PI) / 12;
      const candidate: Vec2 = [center[0] + radius * Math.cos(angle), center[1] + radius * Math.sin(angle)];
      if (canStand(candidate, area)) return candidate;
    }
  }
  return null;
}

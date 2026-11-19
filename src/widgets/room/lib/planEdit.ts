/**
 * 2D 도면 편집 — 바깥벽 다각형과 안쪽 벽 선분을 미터 단위로 고친다(프로토타입 panorama-room.html 이식).
 * 모두 새 배열을 돌려주는 순수 함수(단위 테스트 대상). 좌표는 바닥 평면 [x, z].
 */
import type { Vec2 } from "./geometry";

export type Segment = [Vec2, Vec2];

/** 너무 짧은 벽은 방향을 알 수 없어서 길이를 바꾸지 않는다. */
const MIN_WALL_M = 0.01;
/** 다음 벽이 이 각도(코사인) 안이면 직각으로 본다. */
const PERPENDICULAR_COS = 0.1;

function clone(points: readonly Vec2[]): Vec2[] {
  return points.map(([x, z]) => [x, z]);
}

/**
 * 바깥벽 i(꼭짓점 i → i+1)를 `length`m로 — CAD의 "늘이기".
 * 끝점(i+1)을 벽 방향으로 밀고, 그다음 벽(i+1 → i+2)이 직각이면 i+2도 같이 밀어 모양(직각)을 유지한다.
 */
export function setOuterWallLength(outer: readonly Vec2[], index: number, length: number): Vec2[] {
  const n = outer.length;
  if (n < 3 || !(length > 0)) return clone(outer);
  const next = clone(outer);
  const a = next[index];
  const b = next[(index + 1) % n];
  const current = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (current < MIN_WALL_M) return next;

  const ux = (b[0] - a[0]) / current;
  const uz = (b[1] - a[1]) / current;
  const dx = (length - current) * ux;
  const dz = (length - current) * uz;

  const c = next[(index + 2) % n];
  const vx = c[0] - b[0];
  const vz = c[1] - b[1];
  const perpendicular = n >= 4 && Math.abs((vx * ux + vz * uz) / (Math.hypot(vx, vz) || 1)) < PERPENDICULAR_COS;

  b[0] += dx;
  b[1] += dz;
  if (perpendicular) {
    c[0] += dx;
    c[1] += dz;
  }
  return next;
}

/** 안쪽 벽 i를 `length`m로 — 끝점이 벽 방향으로 움직인다. */
export function setInnerWallLength(inner: readonly Segment[], index: number, length: number): Segment[] {
  return inner.map((segment, i) => {
    const [a, b] = segment;
    if (i !== index || !(length > 0)) return [[...a], [...b]] as Segment;
    const current = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (current < MIN_WALL_M) return [[...a], [...b]] as Segment;
    const k = length / current;
    return [[...a], [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]] as Segment;
  });
}

/** 바깥벽 꼭짓점 지우기 — 3개보다 줄일 수 없으면 null. */
export function removeOuterVertex(outer: readonly Vec2[], index: number): Vec2[] | null {
  if (outer.length <= 3) return null;
  return clone(outer).filter((_, i) => i !== index);
}

/** 바깥벽 i의 가운데에 점을 넣는다(벽을 꺾을 수 있게). 새 점의 번호도 돌려준다. */
export function splitOuterWall(outer: readonly Vec2[], index: number): { outer: Vec2[]; vertex: number } {
  const next = clone(outer);
  const a = next[index];
  const b = next[(index + 1) % next.length];
  next.splice(index + 1, 0, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
  return { outer: next, vertex: index + 1 };
}

/** 안쪽 벽 i를 가운데에서 둘로 나눈다. */
export function splitInnerWall(inner: readonly Segment[], index: number): Segment[] {
  const next = inner.map(([a, b]) => [[...a], [...b]] as Segment);
  const [a, b] = next[index];
  const m: Vec2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  next.splice(index, 1, [a, [...m]], [[...m], b]);
  return next;
}

export function moveOuterVertex(outer: readonly Vec2[], index: number, point: Vec2): Vec2[] {
  return clone(outer).map((p, i) => (i === index ? [point[0], point[1]] : p));
}

/**
 * 스냅 — `from`(이전 점)과 수평·수직(±6°)이면 그 축을 고정하고, 다른 꼭짓점과 x·z가 `tolerance`m 안이면 맞춘다.
 * `tolerance`는 화면 몇 px에 해당하는 거리를 넘긴다(확대해도 같은 느낌).
 */
export function snapPoint(point: Vec2, from: Vec2 | null, vertices: readonly Vec2[], tolerance: number): Vec2 {
  let [x, z] = point;
  let lockX = false;
  let lockZ = false;
  const tan = Math.tan((6 * Math.PI) / 180);
  if (from) {
    const dx = x - from[0];
    const dz = z - from[1];
    if (Math.abs(dz) <= Math.abs(dx) * tan) {
      z = from[1];
      lockZ = true;
    } else if (Math.abs(dx) <= Math.abs(dz) * tan) {
      x = from[0];
      lockX = true;
    }
  }
  let bestX = tolerance;
  let bestZ = tolerance;
  for (const [vx, vz] of vertices) {
    if (!lockX && Math.abs(point[0] - vx) < bestX) {
      bestX = Math.abs(point[0] - vx);
      x = vx;
    }
    if (!lockZ && Math.abs(point[1] - vz) < bestZ) {
      bestZ = Math.abs(point[1] - vz);
      z = vz;
    }
  }
  return [x, z];
}

/** 점 `index`를 끌 때의 스냅 — 양옆 꼭짓점과 수평·수직, 나머지 꼭짓점과 x·z 정렬. */
export function snapOuterVertex(outer: readonly Vec2[], index: number, point: Vec2, tolerance: number): Vec2 {
  const n = outer.length;
  const others = outer.filter((_, i) => i !== index);
  // 앞 꼭짓점과의 수평·수직을 먼저 보고, 뒤 꼭짓점과도 x·z를 맞춘다
  const previous = outer[(index - 1 + n) % n];
  return snapPoint(point, previous, others, tolerance);
}

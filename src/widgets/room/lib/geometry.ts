/**
 * 파노라마 → 방 평면 계산. three.js·브라우저에 의존하지 않는 순수 함수만 둔다(단위 테스트 대상).
 *
 * 좌표계: 사진을 찍은 자리(카메라)가 원점, y가 위, 바닥 평면은 [x, z].
 * 등장방형 사진의 가로 u는 경도(가운데가 정면 +z), 세로 v는 위도(위가 0)다 — HorizonNet 출력과 같은 규칙.
 */

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];

/** 바닥 모서리로 볼 최소 아래 방향(수평선 근처 클릭은 거리가 무한대로 튄다). */
const MIN_DOWN = 0.03;

/** 사진 위 위치(u, v) → 카메라에서 본 단위 방향. */
export function uvToDirection(u: number, v: number): Vec3 {
  const lon = (u - 0.5) * 2 * Math.PI;
  const lat = (0.5 - v) * Math.PI;
  return [-Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)];
}

/** 방향 → 사진 위 위치. `uvToDirection`의 역. */
export function directionToUv([x, y, z]: Vec3): Vec2 {
  const length = Math.hypot(x, y, z) || 1;
  const lon = Math.atan2(-x, z);
  const lat = Math.asin(Math.max(-1, Math.min(1, y / length)));
  return [lon / (2 * Math.PI) + 0.5, 0.5 - lat / Math.PI];
}

/** 바닥 모서리 사진 좌표 → 바닥 평면 위 점. 바닥을 보지 않는 방향이면 null. */
export function floorPointFromUv([u, v]: Vec2, cameraHeight: number): Vec2 | null {
  const [x, y, z] = uvToDirection(u, v);
  if (y > -MIN_DOWN) return null;
  const t = -cameraHeight / y;
  return [x * t, z * t];
}

export function isFloorUv([u, v]: Vec2): boolean {
  return uvToDirection(u, v)[1] <= -MIN_DOWN;
}

/** HorizonNet `uv`(천장·바닥 쌍) → 바닥 모서리만. 쌍마다 아래쪽(v가 큰) 점이 바닥이다. */
export function floorCornersFromLayout(uv: readonly Vec2[]): Vec2[] {
  const corners: Vec2[] = [];
  for (let i = 0; i + 1 < uv.length; i += 2) {
    const a = uv[i];
    const b = uv[i + 1];
    corners.push(a[1] > b[1] ? [a[0], a[1]] : [b[0], b[1]]);
  }
  return corners;
}

/**
 * HorizonNet의 z0(카메라→천장), z1(카메라→바닥, 음수)은 같은 임의 단위라 비율만 맞다.
 * 천장 높이를 알면 촬영 높이가 정해진다: h = 천장 × |z1| / (z0 + |z1|).
 */
export function cameraHeightFromCeiling(ceilingHeight: number, z0: number, z1: number): number {
  return (ceilingHeight * -z1) / (z0 - z1);
}

export function ceilingFromCameraHeight(cameraHeight: number, z0: number, z1: number): number {
  return (cameraHeight * (z0 - z1)) / -z1;
}

/** 바닥 모서리 → 바닥 다각형. 하나라도 바닥이 아니면 null. */
export function outerFromCorners(corners: readonly Vec2[], cameraHeight: number): Vec2[] | null {
  const points: Vec2[] = [];
  for (const corner of corners) {
    const point = floorPointFromUv(corner, cameraHeight);
    if (!point) return null;
    points.push(point);
  }
  return points;
}

/**
 * 천장 모서리를 눌러 천장 높이 재기 — 이미 찍은 바닥 모서리 중 같은 방향(바로 위)인 것을 찾아,
 * 그 모서리까지의 수평 거리와 누른 방향의 기울기로 높이를 구한다. 맞는 모서리가 없거나 위를 보지 않으면 null.
 */
export function measureCeilingHeight(ceilingUv: Vec2, floorPoints: readonly Vec2[], cameraHeight: number): number | null {
  const [x, y, z] = uvToDirection(ceilingUv[0], ceilingUv[1]);
  if (y < MIN_DOWN) return null;
  const azimuth = Math.atan2(-x, z);

  let best: Vec2 | null = null;
  let bestDiff = Infinity;
  for (const point of floorPoints) {
    let diff = Math.abs(Math.atan2(-point[0], point[1]) - azimuth);
    if (diff > Math.PI) diff = 2 * Math.PI - diff;
    if (diff < bestDiff) {
      bestDiff = diff;
      best = point;
    }
  }
  if (!best || bestDiff > 0.25) return null;

  const up = (Math.hypot(best[0], best[1]) * y) / Math.hypot(x, z);
  return cameraHeight + up;
}

/** 신발끈 공식. 반시계면 양수. */
export function signedArea(points: readonly Vec2[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const q = points[(i + 1) % points.length];
    sum += p[0] * q[1] - q[0] * p[1];
  }
  return sum / 2;
}

export function polygonArea(points: readonly Vec2[]): number {
  return Math.abs(signedArea(points));
}

/** 평 = ㎡ ÷ 3.3058 */
export function toPyeong(areaM2: number): number {
  return areaM2 / 3.3058;
}

/** 벽 i = 꼭짓점 i → i+1 의 길이(m). */
export function wallLengths(points: readonly Vec2[]): number[] {
  return points.map((p, i) => {
    const q = points[(i + 1) % points.length];
    return Math.hypot(q[0] - p[0], q[1] - p[1]);
  });
}

export function pointInPolygon([x, z]: Vec2, polygon: readonly Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [ax, az] = polygon[i];
    const [bx, bz] = polygon[j];
    if (az > z !== bz > z && x < ((bx - ax) * (z - az)) / (bz - az) + ax) inside = !inside;
  }
  return inside;
}

/** 점 → 선분 최단 거리. */
export function segmentDistance([x, z]: Vec2, [ax, az]: Vec2, [bx, bz]: Vec2): number {
  const dx = bx - ax;
  const dz = bz - az;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x - ax - t * dx, z - az - t * dz);
}

export function centroid(points: readonly Vec2[]): Vec2 {
  const n = points.length || 1;
  return [points.reduce((s, p) => s + p[0], 0) / n, points.reduce((s, p) => s + p[1], 0) / n];
}

/** 소수점 자리 맞추기 — 서버로 보내는 좌표를 짧게(1mm) 한다. */
export function round(value: number, digits = 3): number {
  const k = 10 ** digits;
  return Math.round(value * k) / k;
}

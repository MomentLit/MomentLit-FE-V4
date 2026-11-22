import { pointInPolygon, type Vec2 } from "./geometry";

/** 안쪽 벽 두께(m) — stage.ts가 그리는 안쪽 벽 상자와 같다. */
export const INNER_WALL_THICKNESS = 0.1;
/** 벽에 붙일 때 벽과 가구 사이 틈(겹쳐 보이지 않게). */
const WALL_GAP = 0.005;

export interface WallSnap {
  /** 가구 중심(바닥 평면). 가구 뒷면이 벽에 닿는다. */
  x: number;
  z: number;
  /** 가구 앞(+z)이 방 안쪽을 보게 하는 y축 회전. */
  rotation: number;
  /** 누른 점에서 벽까지 거리. */
  distance: number;
}

function closestOnSegment(p: Vec2, a: Vec2, b: Vec2): Vec2 {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const lengthSq = dx * dx + dz * dz;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / lengthSq));
  return [a[0] + t * dx, a[1] + t * dz];
}

function unitNormal(a: Vec2, b: Vec2): Vec2 {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const length = Math.hypot(dx, dz) || 1;
  return [-dz / length, dx / length];
}

/** 벽면의 한 점과 방 안쪽 방향 → 깊이 `depth`인 가구를 그 벽에 붙인 자리. */
export function wallMountedAt(face: Vec2, normal: Vec2, depth: number): Pick<WallSnap, "x" | "z" | "rotation"> {
  const offset = depth / 2 + WALL_GAP;
  return { x: face[0] + normal[0] * offset, z: face[1] + normal[1] * offset, rotation: Math.atan2(normal[0], normal[1]) };
}

/**
 * 바닥의 한 점에서 가장 가까운 벽(바깥 벽의 안쪽 면, 안쪽 벽은 누른 쪽 면)에 깊이 `depth`인 가구를 붙인 자리.
 * 도면에서 벽 가구를 놓거나 끌 때, 3D에서 벽 대신 바닥을 눌렀을 때 쓴다.
 */
export function nearestWallPlacement(point: Vec2, outer: readonly Vec2[], inner: readonly (readonly [Vec2, Vec2])[], depth: number): WallSnap | null {
  let best: WallSnap | null = null;
  const consider = (face: Vec2, normal: Vec2, distance: number) => {
    if (best && distance >= best.distance) return;
    best = { ...wallMountedAt(face, normal, depth), distance };
  };

  outer.forEach((a, i) => {
    const b = outer[(i + 1) % outer.length];
    const p = closestOnSegment(point, a, b);
    let normal = unitNormal(a, b);
    // 방 안쪽을 보게
    if (!pointInPolygon([p[0] + normal[0] * 0.05, p[1] + normal[1] * 0.05], outer)) normal = [-normal[0], -normal[1]];
    consider(p, normal, Math.hypot(point[0] - p[0], point[1] - p[1]));
  });

  for (const [a, b] of inner) {
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.05) continue;
    const p = closestOnSegment(point, a, b);
    let normal = unitNormal(a, b);
    // 누른 점이 있는 쪽 면
    if ((point[0] - p[0]) * normal[0] + (point[1] - p[1]) * normal[1] < 0) normal = [-normal[0], -normal[1]];
    const half = INNER_WALL_THICKNESS / 2;
    const face: Vec2 = [p[0] + normal[0] * half, p[1] + normal[1] * half];
    consider(face, normal, Math.max(0, Math.hypot(point[0] - p[0], point[1] - p[1]) - half));
  }
  return best;
}

/** 벽에 걸 때 높이 — 가운데가 `centerHeight`에 오게 하되 바닥·천장을 넘지 않게(가구 밑면 높이를 돌려준다). */
export function wallMountY(centerHeight: number, height: number, ceilingHeight: number): number {
  return Math.max(0, Math.min(ceilingHeight - height, centerHeight - height / 2));
}

/** 벽 가구를 처음 걸 때 가운데 높이(눈높이쯤). */
export const DEFAULT_WALL_CENTER = 1.5;

/** 천장에 달 때 밑면 높이. */
export function ceilingMountY(height: number, ceilingHeight: number): number {
  return Math.max(0, ceilingHeight - height);
}

interface PlacedItem {
  type: string;
  x: number;
  z: number;
  rotation: number;
  y?: number | null;
}

interface Footprint {
  width: number;
  depth: number;
  height?: number;
  mount?: "floor" | "wall" | "ceiling";
}

/**
 * `index` 가구 위에 올려 둔 바닥 소품들(그 위의 것까지) — 가구 크기(가로·세로·높이)와 회전으로 판단한다.
 * 도면에서 받침 가구를 끌 때 같이 옮기는 데 쓴다(3D 무대는 실제 모델 상자로 판단한다).
 */
export function itemsOnTop(items: readonly PlacedItem[], index: number, find: (type: string) => Footprint | undefined): number[] {
  const result: number[] = [];
  const visit = (baseIndex: number) => {
    const base = items[baseIndex];
    const def = base && find(base.type);
    if (!def) return;
    const baseY = base.y ?? 0;
    const top = baseY + (def.height ?? 1) + 0.05;
    const cos = Math.cos(base.rotation);
    const sin = Math.sin(base.rotation);
    items.forEach((item, j) => {
      if (j === index || result.includes(j) || (find(item.type)?.mount ?? "floor") !== "floor") return;
      const y = item.y ?? 0;
      if (y <= baseY + 0.02 || y > top) return;
      const dx = item.x - base.x;
      const dz = item.z - base.z;
      // 가구 회전을 되돌려 가구 자신의 가로·세로 축으로
      const lx = dx * cos - dz * sin;
      const lz = dx * sin + dz * cos;
      if (Math.abs(lx) > def.width / 2 || Math.abs(lz) > def.depth / 2) return;
      result.push(j);
      visit(j);
    });
  };
  visit(index);
  return result;
}

import type { FurnitureItem } from "@/entities/room";
import type { FurnitureDef } from "./furniture";
import { pointInPolygon, type Vec2 } from "./geometry";
import { itemsOnTop, nearestWallPlacement } from "./placement";

/** 붙여넣을 때마다 원래 자리에서 이만큼(m)씩 비켜 놓는다 — 겹쳐서 안 보이지 않게. */
export const PASTE_STEP = 0.3;

/** 바닥·천장 가구를 비켜 놓아 볼 방향 — 방 밖으로 나가면 다음 방향을 쓴다. */
const DIRECTIONS: readonly Vec2[] = [
  [1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1],
].map(([x, z]) => {
  const length = Math.hypot(x, z);
  return [x / length, z / length] as Vec2;
});

type Find = (type: string) => FurnitureDef | undefined;

/** 복사해 둔 가구 — 첫 번째가 고른 가구, 나머지는 그 위에 올려 둔 소품(같이 복사된다). */
export type FurnitureClipboard = FurnitureItem[];

/** `index` 가구(+ 위에 올린 소품)를 복사한다. 없는 번호면 null. */
export function copyFurniture(items: readonly FurnitureItem[], index: number, find: Find): FurnitureClipboard | null {
  const base = items[index];
  if (!base) return null;
  const riders = itemsOnTop(items, index, (type) => {
    const def = find(type);
    return def && { ...def, mount: def.mount ?? "floor" };
  });
  return [base, ...riders.map((i) => items[i])].map((item) => ({ ...item }));
}

/**
 * 복사한 가구를 `count`번째(1부터)로 붙여넣을 자리 — 원래 자리에서 `count × PASTE_STEP`만큼 비켜 놓는다.
 * 벽 가구는 벽을 따라 옆으로 밀고 가장 가까운 벽에 다시 붙인다. 바닥·천장 가구는 방 안에 들어가는 첫 방향을 쓴다.
 * 높이(y)는 그대로 둔다 — 받침에서 벗어난 소품은 3D 무대가 내려앉힌다.
 */
export function pasteFurniture(
  clipboard: FurnitureClipboard,
  count: number,
  room: { outer: readonly Vec2[]; inner: readonly (readonly [Vec2, Vec2])[] },
  find: Find,
): FurnitureItem[] {
  const [base] = clipboard;
  if (!base) return [];
  const distance = PASTE_STEP * Math.max(1, count);
  const def = find(base.type);

  if (def?.mount === "wall") {
    // 가구 앞(+z)이 (sin r, cos r)이니 벽을 따라가는 방향은 (cos r, -sin r)
    const along: Vec2 = [Math.cos(base.rotation), -Math.sin(base.rotation)];
    for (const sign of [1, -1]) {
      const snap = nearestWallPlacement(
        [base.x + along[0] * distance * sign, base.z + along[1] * distance * sign],
        room.outer,
        room.inner,
        def.depth,
      );
      if (snap && Math.hypot(snap.x - base.x, snap.z - base.z) > 0.05) {
        return [{ ...base, x: snap.x, z: snap.z, rotation: snap.rotation }];
      }
    }
    return [{ ...base }];
  }

  const direction = DIRECTIONS.find(([dx, dz]) =>
    clipboard.every((item) => pointInPolygon([item.x + dx * distance, item.z + dz * distance], room.outer)),
  );
  const [dx, dz] = direction ? [direction[0] * distance, direction[1] * distance] : [0, 0];
  return clipboard.map((item) => ({ ...item, x: item.x + dx, z: item.z + dz }));
}

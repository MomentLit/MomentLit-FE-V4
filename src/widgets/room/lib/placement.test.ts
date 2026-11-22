import { describe, expect, it } from "vitest";
import { ceilingMountY, itemsOnTop, nearestWallPlacement, wallMountY } from "./placement";
import type { Vec2 } from "./geometry";

const square: Vec2[] = [[0, 0], [4, 0], [4, 3], [0, 3]];

describe("nearestWallPlacement", () => {
  it("가장 가까운 바깥 벽에 붙이고 방 안쪽을 보게 돌린다", () => {
    const snap = nearestWallPlacement([2, 0.4], square, [], 0.1)!;
    expect(snap.x).toBeCloseTo(2);
    expect(snap.z).toBeCloseTo(0.055); // 벽(z=0) + 깊이 절반 + 틈
    expect(Math.sin(snap.rotation)).toBeCloseTo(0); // 앞(+z)이 방 안쪽(+z)
    expect(Math.cos(snap.rotation)).toBeCloseTo(1);
  });

  it("오른쪽 벽이면 -x를 본다", () => {
    const snap = nearestWallPlacement([3.8, 1.5], square, [], 0.2)!;
    expect(snap.x).toBeCloseTo(4 - 0.105);
    expect(Math.sin(snap.rotation)).toBeCloseTo(-1);
  });

  it("벽 끝보다 바깥을 누르면 벽 끝에 붙인다", () => {
    const snap = nearestWallPlacement([-1, 1.5], square, [], 0.1)!;
    expect(snap.x).toBeCloseTo(0.055);
    expect(snap.z).toBeCloseTo(1.5);
  });

  it("안쪽 벽은 누른 쪽 면에 두께만큼 띄워 붙인다", () => {
    const inner: [Vec2, Vec2][] = [[[2, 0], [2, 3]]];
    const left = nearestWallPlacement([1.8, 1], square, inner, 0.1)!;
    expect(left.x).toBeCloseTo(2 - 0.05 - 0.055);
    expect(Math.sin(left.rotation)).toBeCloseTo(-1);
    const right = nearestWallPlacement([2.3, 1], square, inner, 0.1)!;
    expect(right.x).toBeCloseTo(2 + 0.05 + 0.055);
    expect(Math.sin(right.rotation)).toBeCloseTo(1);
  });

  it("시계 방향 다각형에서도 안쪽을 본다", () => {
    const snap = nearestWallPlacement([2, 0.4], [...square].reverse(), [], 0.1)!;
    expect(snap.z).toBeCloseTo(0.055);
  });
});

describe("높이", () => {
  it("벽 가구는 바닥·천장을 넘지 않는다", () => {
    expect(wallMountY(1.5, 0.6, 2.4)).toBeCloseTo(1.2);
    expect(wallMountY(0.1, 0.6, 2.4)).toBe(0);
    expect(wallMountY(2.4, 0.6, 2.4)).toBeCloseTo(1.8);
  });

  it("천장 가구는 천장에 매단다", () => {
    expect(ceilingMountY(0.8, 2.4)).toBeCloseTo(1.6);
    expect(ceilingMountY(3, 2.4)).toBe(0);
  });
});

describe("itemsOnTop", () => {
  const defs: Record<string, { width: number; depth: number; height: number; mount?: "floor" | "wall" | "ceiling" }> = {
    table: { width: 2, depth: 0.5, height: 0.75 },
    vase: { width: 0.2, depth: 0.2, height: 0.3 },
    frame: { width: 0.5, depth: 0.03, height: 0.4, mount: "wall" },
  };
  const find = (type: string) => defs[type];

  it("받침 위의 소품과 그 위의 소품까지 찾는다", () => {
    const items = [
      { type: "table", x: 0, z: 0, rotation: 0, y: 0 },
      { type: "vase", x: 0.8, z: 0.1, rotation: 0, y: 0.75 },
      { type: "vase", x: 0.8, z: 0.1, rotation: 0, y: 1.05 }, // 화병 위 화병
      { type: "vase", x: 1.5, z: 0, rotation: 0, y: 0.75 }, // 탁자 밖(떠 있음)
      { type: "vase", x: 0.2, z: 0, rotation: 0, y: 0 }, // 바닥(탁자 밑)
      { type: "frame", x: 0, z: 0.2, rotation: 0, y: 1 }, // 벽 가구는 따라가지 않는다
    ];
    expect(itemsOnTop(items, 0, find).sort()).toEqual([1, 2]);
  });

  it("받침 회전을 따른다 — 90° 돌린 긴 탁자는 z 방향으로 길다", () => {
    const items = [
      { type: "table", x: 0, z: 0, rotation: Math.PI / 2, y: 0 },
      { type: "vase", x: 0, z: 0.8, rotation: 0, y: 0.75 },
      { type: "vase", x: 0.8, z: 0, rotation: 0, y: 0.75 },
    ];
    expect(itemsOnTop(items, 0, find)).toEqual([1]);
  });
});

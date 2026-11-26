import { describe, expect, it } from "vitest";
import type { FurnitureDef } from "./furniture";
import type { Vec2 } from "./geometry";
import { copyFurniture, PASTE_STEP, pasteFurniture } from "./clipboard";

const DEFS: Record<string, FurnitureDef> = {
  table: { id: "table", name: "탁자", width: 1.2, depth: 0.8, height: 0.75 },
  vase: { id: "vase", name: "꽃병", width: 0.2, depth: 0.2, height: 0.3 },
  chair: { id: "chair", name: "의자", width: 0.5, depth: 0.5, height: 0.9 },
  frame: { id: "frame", name: "액자", width: 0.6, depth: 0.05, height: 0.4, mount: "wall" },
};
const find = (type: string) => DEFS[type];
// 4m × 4m 방(원점 가운데)
const ROOM = { outer: [[-2, -2], [2, -2], [2, 2], [-2, 2]] as Vec2[], inner: [] };

describe("copyFurniture", () => {
  it("고른 가구와 그 위에 올린 소품을 같이 복사한다", () => {
    const items = [
      { type: "table", x: 0, z: 0, y: 0, rotation: 0 },
      { type: "vase", x: 0.1, z: 0, y: 0.75, rotation: 0 },
      { type: "chair", x: 1, z: 1, y: 0, rotation: 0 },
    ];
    expect(copyFurniture(items, 0, find)?.map((item) => item.type)).toEqual(["table", "vase"]);
    expect(copyFurniture(items, 2, find)?.map((item) => item.type)).toEqual(["chair"]);
    expect(copyFurniture(items, 5, find)).toBeNull();
  });
});

describe("pasteFurniture", () => {
  it("붙여넣을 때마다 조금씩 더 비켜 놓고, 소품은 받침과 같이 옮긴다", () => {
    const clipboard = [
      { type: "table", x: 0, z: 0, y: 0, rotation: 0 },
      { type: "vase", x: 0.1, z: 0, y: 0.75, rotation: 0 },
    ];
    const first = pasteFurniture(clipboard, 1, ROOM, find);
    const second = pasteFurniture(clipboard, 2, ROOM, find);
    expect(Math.hypot(first[0].x, first[0].z)).toBeCloseTo(PASTE_STEP);
    expect(Math.hypot(second[0].x, second[0].z)).toBeCloseTo(PASTE_STEP * 2);
    expect(first[1].x - first[0].x).toBeCloseTo(0.1);
    expect(first[1].y).toBe(0.75);
  });

  it("방 밖으로 나가면 다른 방향으로 비켜 놓는다", () => {
    const [pasted] = pasteFurniture([{ type: "chair", x: 1.9, z: 1.9, y: 0, rotation: 0 }], 1, ROOM, find);
    expect(pasted.x).toBeLessThan(1.9);
    expect(pasted.z).toBeLessThan(1.9);
  });

  it("벽 가구는 같은 벽을 따라 옆으로 옮긴다", () => {
    // 아래쪽 벽(z = -2)에 붙어 방 안쪽(+z)을 보는 액자
    const frame = { type: "frame", x: 0, z: -1.97, y: 1.3, rotation: 0 };
    const [pasted] = pasteFurniture([frame], 1, ROOM, find);
    expect(pasted.z).toBeCloseTo(frame.z, 2);
    expect(Math.abs(pasted.x)).toBeCloseTo(PASTE_STEP);
    expect(pasted.y).toBe(1.3);
  });
});

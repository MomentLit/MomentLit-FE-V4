import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { localFurnitureBox, nearestFurnitureBox } from "./furniturePick";

/** 다리 두 개만 있는 "구멍 난" 가구 — 가운데(x=0)는 비어 있다. */
function hollowFurniture(index: number, x: number, rotationY = 0) {
  const group = new THREE.Group();
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1, 0.4));
    leg.position.set(side * 0.45, 0.5, 0);
    group.add(leg);
  }
  group.position.set(x, 0, 0);
  group.rotation.y = rotationY;
  group.userData.index = index;
  group.updateMatrixWorld(true);
  return group;
}

const downAt = (x: number, z: number) => new THREE.Ray(new THREE.Vector3(x, 5, z), new THREE.Vector3(0, -1, 0));

describe("nearestFurnitureBox", () => {
  it("메시 사이 빈 곳을 눌러도 그 가구를 고른다", () => {
    const furniture = hollowFurniture(0, 0);
    const raycaster = new THREE.Raycaster(downAt(0, 0).origin, downAt(0, 0).direction);
    expect(raycaster.intersectObject(furniture, true)).toHaveLength(0); // 메시만으로는 빗나감
    expect(nearestFurnitureBox(THREE, downAt(0, 0), [furniture])).toBe(0);
  });

  it("상자 밖은 고르지 않는다", () => {
    expect(nearestFurnitureBox(THREE, downAt(0, 0.5), [hollowFurniture(0, 0)])).toBeNull();
  });

  it("가구 회전을 따라간다 — 90° 돌린 가구는 z 방향으로 길다", () => {
    const turned = hollowFurniture(0, 0, Math.PI / 2);
    expect(nearestFurnitureBox(THREE, downAt(0, 0.4), [turned])).toBe(0);
    expect(nearestFurnitureBox(THREE, downAt(0.4, 0), [turned])).toBeNull();
  });

  it("여러 개면 광선에 가장 가까운 가구", () => {
    const low = hollowFurniture(0, 0);
    const high = hollowFurniture(1, 0);
    high.position.y = 1.5;
    high.updateMatrixWorld(true);
    expect(nearestFurnitureBox(THREE, downAt(0, 0), [low, undefined, high])).toBe(1);
  });

  it("상자는 위치·회전과 무관하게 가구 자신의 좌표로 잰다", () => {
    const box = localFurnitureBox(THREE, hollowFurniture(0, 3, 1));
    expect(box.min.x).toBeCloseTo(-0.5);
    expect(box.max.x).toBeCloseTo(0.5);
    expect(box.max.y).toBeCloseTo(1);
  });
});

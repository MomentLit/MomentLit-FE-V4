import { describe, expect, it } from "vitest";
import {
  cameraHeightFromCeiling,
  ceilingFromCameraHeight,
  directionToUv,
  floorCornersFromLayout,
  floorPointFromUv,
  measureCeilingHeight,
  outerFromCorners,
  pointInPolygon,
  polygonArea,
  segmentDistance,
  uvToDirection,
  wallLengths,
  type Vec2,
} from "./geometry";

/** 바닥 위 점(카메라 기준, 높이 h 아래)을 사진 좌표로 — 테스트용 역변환. */
function uvOfFloorPoint([x, z]: Vec2, h: number): Vec2 {
  return directionToUv([x, -h, z]);
}

describe("사진 좌표 ↔ 방향", () => {
  it("사진 가운데는 정면(+z) 수평 방향이다", () => {
    const [x, y, z] = uvToDirection(0.5, 0.5);
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(0);
    expect(z).toBeCloseTo(1);
  });

  it("사진 맨 아래는 바로 아래다", () => {
    expect(uvToDirection(0.3, 1)[1]).toBeCloseTo(-1);
  });

  it("방향 → 사진 좌표 → 방향이 되돌아온다", () => {
    for (const [u, v] of [[0.1, 0.7], [0.62, 0.55], [0.9, 0.2]] as Vec2[]) {
      const [u2, v2] = directionToUv(uvToDirection(u, v));
      expect(u2).toBeCloseTo(u);
      expect(v2).toBeCloseTo(v);
    }
  });
});

describe("바닥 모서리 → 평면", () => {
  const h = 1.5;
  const room: Vec2[] = [[-2, -1.5], [2, -1.5], [2, 1.5], [-2, 1.5]];

  it("사진 좌표에서 바닥 점을 되찾는다", () => {
    for (const p of room) {
      const point = floorPointFromUv(uvOfFloorPoint(p, h), h)!;
      expect(point[0]).toBeCloseTo(p[0]);
      expect(point[1]).toBeCloseTo(p[1]);
    }
  });

  it("수평선 위(벽·천장)를 누르면 바닥 점이 없다", () => {
    expect(floorPointFromUv([0.5, 0.4], h)).toBeNull();
    expect(floorPointFromUv([0.5, 0.5], h)).toBeNull();
  });

  it("4×3m 방의 면적과 벽 길이를 계산한다", () => {
    const outer = outerFromCorners(room.map((p) => uvOfFloorPoint(p, h)), h)!;
    expect(polygonArea(outer)).toBeCloseTo(12);
    const lengths = wallLengths(outer);
    expect(lengths[0]).toBeCloseTo(4);
    expect(lengths[1]).toBeCloseTo(3);
  });

  it("촬영 높이에 비례해서 방 크기가 바뀐다", () => {
    const corners = room.map((p) => uvOfFloorPoint(p, h));
    expect(polygonArea(outerFromCorners(corners, h * 2)!)).toBeCloseTo(48);
  });
});

describe("HorizonNet 결과", () => {
  it("천장·바닥 쌍에서 아래쪽(바닥) 점만 고른다", () => {
    expect(floorCornersFromLayout([[0.1, 0.3], [0.1, 0.7], [0.4, 0.65], [0.4, 0.35]])).toEqual([[0.1, 0.7], [0.4, 0.65]]);
  });

  it("천장 높이로 촬영 높이를 정하고, 그 역도 맞다", () => {
    // 카메라→천장 0.9, 카메라→바닥 1.5 (같은 단위) → 천장 2.4m면 촬영 높이 1.5m
    expect(cameraHeightFromCeiling(2.4, 0.9, -1.5)).toBeCloseTo(1.5);
    expect(ceilingFromCameraHeight(1.5, 0.9, -1.5)).toBeCloseTo(2.4);
    // 실제 응답 예: z0=50, z1=-58.42
    const h = cameraHeightFromCeiling(2.4, 50, -58.42);
    expect(ceilingFromCameraHeight(h, 50, -58.42)).toBeCloseTo(2.4);
  });
});

describe("천장 모서리로 천장 높이 재기", () => {
  const h = 1.5;
  const floor: Vec2[] = [[-2, -1.5], [2, -1.5], [2, 1.5], [-2, 1.5]];

  it("바닥 모서리 바로 위 천장 모서리를 누르면 천장 높이가 나온다", () => {
    const ceilingUv = directionToUv([2, 2.6 - h, 1.5]);
    expect(measureCeilingHeight(ceilingUv, floor, h)).toBeCloseTo(2.6);
  });

  it("바닥 쪽을 누르거나 근처에 바닥 모서리가 없으면 null", () => {
    expect(measureCeilingHeight(directionToUv([2, -1, 1.5]), floor, h)).toBeNull();
    expect(measureCeilingHeight(directionToUv([0, 1, 3]), floor, h)).toBeNull();
  });
});

describe("평면 판정", () => {
  const l: Vec2[] = [[0, 0], [4, 0], [4, 2], [2, 2], [2, 4], [0, 4]];

  it("L자 방 안팎을 구분한다", () => {
    expect(pointInPolygon([1, 3], l)).toBe(true);
    expect(pointInPolygon([3, 3], l)).toBe(false);
    expect(pointInPolygon([5, 1], l)).toBe(false);
    expect(polygonArea(l)).toBeCloseTo(12);
  });

  it("점과 선분 사이 거리", () => {
    expect(segmentDistance([1, 1], [0, 0], [2, 0])).toBeCloseTo(1);
    expect(segmentDistance([3, 0], [0, 0], [2, 0])).toBeCloseTo(1);
  });
});

import { describe, expect, it } from "vitest";
import { polygonArea, wallLengths, type Vec2 } from "./geometry";
import {
  moveOuterVertex,
  removeOuterVertex,
  setInnerWallLength,
  setOuterWallLength,
  snapOuterVertex,
  snapPoint,
  splitInnerWall,
  splitOuterWall,
  type Segment,
} from "./planEdit";

const RECT: Vec2[] = [[0, 0], [4, 0], [4, 3], [0, 3]];

describe("벽 길이 바꾸기(늘이기)", () => {
  it("직사각형 벽을 늘이면 이어진 직각 벽도 같이 밀려 직사각형이 유지된다", () => {
    const next = setOuterWallLength(RECT, 0, 5);
    expect(next).toEqual([[0, 0], [5, 0], [5, 3], [0, 3]]);
    expect(wallLengths(next)).toEqual([5, 3, 5, 3]);
    expect(polygonArea(next)).toBeCloseTo(15);
  });

  it("줄일 수도 있다", () => {
    const next = setOuterWallLength(RECT, 1, 2.5);
    expect(wallLengths(next)[1]).toBeCloseTo(2.5);
    expect(polygonArea(next)).toBeCloseTo(10);
  });

  it("다음 벽이 직각이 아니면 끝점만 움직인다", () => {
    const triangle: Vec2[] = [[0, 0], [4, 0], [2, 3]];
    const next = setOuterWallLength(triangle, 0, 5);
    expect(next[1]).toEqual([5, 0]);
    expect(next[2]).toEqual([2, 3]);
  });

  it("원래 배열은 바꾸지 않는다", () => {
    setOuterWallLength(RECT, 0, 6);
    expect(RECT[1]).toEqual([4, 0]);
  });

  it("안쪽 벽은 끝점이 벽 방향으로 움직인다", () => {
    const inner: Segment[] = [[[1, 0], [1, 2]]];
    expect(setInnerWallLength(inner, 0, 3)).toEqual([[[1, 0], [1, 3]]]);
  });
});

describe("점 지우기·추가", () => {
  it("꼭짓점을 지우되 3개보다 줄이지 않는다", () => {
    expect(removeOuterVertex(RECT, 3)).toHaveLength(3);
    expect(removeOuterVertex(RECT.slice(0, 3), 0)).toBeNull();
  });

  it("벽 가운데에 점을 넣는다", () => {
    const { outer, vertex } = splitOuterWall(RECT, 0);
    expect(outer).toHaveLength(5);
    expect(vertex).toBe(1);
    expect(outer[1]).toEqual([2, 0]);
    expect(polygonArea(outer)).toBeCloseTo(12);
  });

  it("마지막 벽(닫는 벽)도 나눌 수 있다", () => {
    const { outer } = splitOuterWall(RECT, 3);
    expect(outer[4]).toEqual([0, 1.5]);
  });

  it("안쪽 벽을 둘로 나눈다", () => {
    expect(splitInnerWall([[[0, 0], [2, 0]]], 0)).toEqual([[[0, 0], [1, 0]], [[1, 0], [2, 0]]]);
  });
});

describe("스냅", () => {
  it("이전 점과 거의 수평이면 수평으로 맞춘다", () => {
    expect(snapPoint([3, 0.1], [0, 0], [], 0.05)).toEqual([3, 0]);
  });

  it("다른 꼭짓점과 x가 가까우면 맞춘다", () => {
    expect(snapPoint([3.97, 2], null, [[4, 0]], 0.05)).toEqual([4, 2]);
  });

  it("멀면 그대로 둔다", () => {
    expect(snapPoint([3.5, 1.7], null, [[4, 0]], 0.05)).toEqual([3.5, 1.7]);
  });

  it("꼭짓점을 끌면 이웃과 직각이 되게 맞춘다", () => {
    const point = snapOuterVertex(RECT, 2, [4.02, 3.3], 0.05);
    expect(point).toEqual([4, 3.3]);
    expect(moveOuterVertex(RECT, 2, point)[2]).toEqual([4, 3.3]);
  });
});

describe("파노라마 방을 도면에서 고치기", () => {
  it("고친 바닥 점을 사진 좌표로 바꿨다가 되돌려도 같은 모양이고, 촬영 높이를 바꾸면 비례해서 커진다", async () => {
    const { directionToUv, outerFromCorners } = await import("./geometry");
    const h = 1.5;
    const edited = setOuterWallLength([[-2, -1.5], [2, -1.5], [2, 1.5], [-2, 1.5]], 0, 5);
    const corners = edited.map(([x, z]) => directionToUv([x, -h, z]));
    const back = outerFromCorners(corners, h)!;
    back.forEach((p, i) => {
      expect(p[0]).toBeCloseTo(edited[i][0]);
      expect(p[1]).toBeCloseTo(edited[i][1]);
    });
    expect(polygonArea(back)).toBeCloseTo(15);
    expect(polygonArea(outerFromCorners(corners, h * 2)!)).toBeCloseTo(60);
  });
});

import { describe, expect, it } from "vitest";
import { knownFurniture, normalizeRotation } from "./furniture";
import type { Vec2 } from "./geometry";
import { BODY_RADIUS, canStand, eyeHeight, startPosition, step, type WalkArea } from "./walk";

const room: WalkArea = { outer: [[-2, -1.5], [2, -1.5], [2, 1.5], [-2, 1.5]], inner: [] };

describe("1인칭 걷기", () => {
  it("방 안 가운데에는 설 수 있고, 벽에 몸이 닿으면 못 선다", () => {
    expect(canStand([0, 0], room)).toBe(true);
    expect(canStand([2 - BODY_RADIUS / 2, 0], room)).toBe(false);
    expect(canStand([3, 0], room)).toBe(false);
  });

  it("안쪽 벽도 통과하지 못한다", () => {
    const withWall: WalkArea = { ...room, inner: [[[0, -1.5], [0, 0.5]]] };
    expect(canStand([0.1, 0], withWall)).toBe(false);
    expect(canStand([0, 1.1], withWall)).toBe(true);
  });

  it("벽에 비스듬히 부딪히면 벽을 따라 미끄러진다", () => {
    const start: Vec2 = [1.7, 0];
    const next = step(start, 0.2, 0.2, room)!;
    expect(next[0]).toBe(1.7);
    expect(next[1]).toBeCloseTo(0.2);
  });

  it("완전히 막히면 움직이지 않는다", () => {
    expect(step([1.7, 1.2], 0.2, 0.2, room)).toBeNull();
  });

  it("시작 자리가 벽에 걸리면 근처 빈 곳을 찾는다", () => {
    const start = startPosition(room, [1.95, 0])!;
    expect(canStand(start, room)).toBe(true);
    expect(startPosition(room, null)).toEqual([0, 0]);
  });

  it("눈높이는 1.6m, 천장이 낮으면 천장 − 0.3m", () => {
    expect(eyeHeight(2.4)).toBe(1.6);
    expect(eyeHeight(1.8)).toBeCloseTo(1.5);
  });
});

describe("가구", () => {
  it("모르는 가구 종류는 뺀다", () => {
    expect(knownFurniture([{ type: "sofa-3" }, { type: "spaceship" }])).toEqual([{ type: "sofa-3" }]);
  });

  it("회전은 -π~π로 맞춘다", () => {
    expect(normalizeRotation(Math.PI * 2.5)).toBeCloseTo(Math.PI / 2);
    expect(normalizeRotation(-Math.PI * 1.5)).toBeCloseTo(Math.PI / 2);
  });
});

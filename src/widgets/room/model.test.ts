import { describe, expect, it } from "vitest";
import type { Room } from "@/entities/room";
import { directionToUv } from "./lib/geometry";
import {
  createRoomDraft,
  isSameRoomDraft,
  roomToDraft,
  summarizeRoom,
  toRoomRequest,
  validateRoomDraft,
  withCameraHeight,
  withCeilingHeight,
  type RoomDraft,
} from "./model";

const IMAGE = "https://bucket.s3.ap-northeast-2.amazonaws.com/images/pano.jpg";

function draftOf(points: [number, number][], h = 1.5): RoomDraft {
  return {
    ...createRoomDraft(IMAGE),
    cameraHeight: h,
    corners: points.map(([x, z]) => directionToUv([x, -h, z])),
  };
}

const RECT: [number, number][] = [[-2, -1.5], [2, -1.5], [2, 1.5], [-2, 1.5]];

describe("방 초안", () => {
  it("모서리가 3개 미만이면 저장할 수 없다", () => {
    expect(validateRoomDraft(draftOf(RECT.slice(0, 2)))).toMatch(/3개/);
  });

  it("촬영 높이가 천장보다 높으면 저장할 수 없다", () => {
    expect(validateRoomDraft({ ...draftOf(RECT), ceilingHeight: 1.9, cameraHeight: 2 })).toMatch(/낮아야/);
  });

  it("바닥이 아닌 곳을 찍은 모서리가 있으면 저장할 수 없다", () => {
    const draft = draftOf(RECT);
    expect(validateRoomDraft({ ...draft, corners: [...draft.corners, [0.5, 0.3]] })).toMatch(/모서리/);
  });

  it("올바른 초안은 미터 좌표 요청으로 바뀐다", () => {
    const draft = draftOf(RECT);
    expect(validateRoomDraft(draft)).toBeNull();
    const request = toRoomRequest(draft);
    expect(request.source).toBe("PANORAMA");
    expect(request.camera_height).toBe(1.5);
    expect(request.geometry.camera).toEqual([0, 0]);
    expect(request.geometry.outer).toEqual(RECT);
    expect(request.geometry.corners).toHaveLength(4);
    expect(summarizeRoom(draft)!.areaPyeong).toBeCloseTo(12 / 3.3058);
  });

  it("자동 인식 비율이 있으면 천장 높이와 촬영 높이가 연동된다", () => {
    const draft: RoomDraft = { ...draftOf(RECT), layoutRatio: { z0: 0.9, z1: -1.5 } };
    expect(withCeilingHeight(draft, 2.4).cameraHeight).toBe(1.5);
    expect(withCameraHeight(draft, 1.5).ceilingHeight).toBe(2.4);
  });

  it("비율이 없으면 서로 따로 움직인다", () => {
    const draft = draftOf(RECT);
    expect(withCeilingHeight(draft, 2.7).cameraHeight).toBe(1.5);
  });

  it("저장된 방을 다시 편집 초안으로 연다", () => {
    const request = toRoomRequest(draftOf(RECT));
    const room: Room = {
      space_id: 1,
      scene_id: null,
      area_m2: 12,
      area_pyeong: 3.6,
      updated_at: "2026-11-19T00:00:00",
      ...request,
    };
    const reopened = roomToDraft(room)!;
    expect(reopened.imageUrl).toBe(IMAGE);
    expect(summarizeRoom(reopened)!.areaM2).toBeCloseTo(12, 2);
    expect(isSameRoomDraft(reopened, roomToDraft(room))).toBe(true);
    expect(isSameRoomDraft(reopened, withCeilingHeight(reopened, 2.7))).toBe(false);
  });
});

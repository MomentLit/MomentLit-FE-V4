import { describe, expect, it } from "vitest";
import type { Room } from "@/entities/room";
import { directionToUv } from "./lib/geometry";
import {
  createRoomDraft,
  innerToRelative,
  isSameRoomDraft,
  keepRoomsForScenes,
  planRoomSaves,
  roomPlacement,
  roomToDraft,
  scaleRoomFromWall,
  setRoomForScene,
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

describe("벽 하나로 파노라마 방 크기 맞추기", () => {
  it.each([null, { z0: 0.9, z1: -1.5 }])("천장 비율(%j) 유무와 관계없이 사진에서 보이는 모서리를 유지한다", (layoutRatio) => {
    const draft = { ...draftOf(RECT), layoutRatio, inner: innerToRelative([[[0, -1.5], [0, 0.5]]], 1.5) };
    const current = summarizeRoom(draft)!;
    const result = scaleRoomFromWall(draft, current.wallLengths[0], 6);
    expect(result.error).toBeUndefined();
    const scaled = result.draft!;
    const next = summarizeRoom(scaled)!;
    expect(scaled.corners).toBe(draft.corners);
    expect(scaled.imageUrl).toBe(draft.imageUrl);
    expect(scaled.layoutRatio).toBe(layoutRatio);
    expect(scaled.cameraHeight).toBeCloseTo(2.25);
    expect(scaled.ceilingHeight).toBeCloseTo(3.6);
    expect(next.wallLengths[0]).toBeCloseTo(6);
    expect(next.wallLengths[1]).toBeCloseTo(4.5);
    expect(next.inner[0][1][1]).toBeCloseTo(0.75);
    for (const [index, [outerX, outerZ]] of next.outer.entries()) {
      const [originalX, originalZ] = current.outer[index];
      const originalUv = directionToUv([originalX, draft.ceilingHeight - draft.cameraHeight, originalZ]);
      const scaledUv = directionToUv([outerX, scaled.ceilingHeight - scaled.cameraHeight, outerZ]);
      expect(scaledUv[0]).toBeCloseTo(originalUv[0], 8);
      expect(scaledUv[1]).toBeCloseTo(originalUv[1], 8);
    }
  });

  it.each([[0, 6], [4, Infinity], [4, -1], [4, 2], [4, 8]])("유효하지 않거나 높이 제한을 넘는 축척(%s → %s)은 적용하지 않는다", (current, actual) => {
    const draft = draftOf(RECT);
    const result = scaleRoomFromWall(draft, current, actual);
    expect(result.draft).toBeUndefined();
    expect(result.error).toBeTruthy();
    expect(draft.cameraHeight).toBe(1.5);
    expect(draft.ceilingHeight).toBe(2.4);
  });
});

describe("파노라마 방의 안쪽 벽", () => {
  it("촬영 높이 기준으로 저장해서, 촬영 높이를 바꾸면 바깥벽과 같은 비율로 커진다", () => {
    const draft = { ...draftOf(RECT), inner: innerToRelative([[[0, -1.5], [0, 0.5]]], 1.5) };
    expect(summarizeRoom(draft)!.inner[0][1][1]).toBeCloseTo(0.5);
    const taller = summarizeRoom({ ...draft, cameraHeight: 3 })!;
    expect(taller.inner[0][1][1]).toBeCloseTo(1);
    expect(taller.outer[2][0]).toBeCloseTo(4);
  });

  it("저장 요청에 m로 들어가고, 다시 열면 그대로 돌아온다", () => {
    const draft = { ...draftOf(RECT), inner: innerToRelative([[[0, -1.5], [0, 0.5]]], 1.5) };
    const request = toRoomRequest(draft, { name: "거실", sortOrder: 0 });
    expect(request.geometry.inner).toEqual([[[0, -1.5], [0, 0.5]]]);
    const room: Room = { room_id: 1, space_id: 1, area_m2: 12, area_pyeong: 3.6, updated_at: "", ...request };
    expect(summarizeRoom(roomToDraft(room)!)!.inner[0][1][1]).toBeCloseTo(0.5);
  });
});

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
    const request = toRoomRequest(draft, { name: "거실", sortOrder: 0 });
    expect(request.source).toBe("PANORAMA");
    expect(request.name).toBe("거실");
    expect(request.scene_image_url).toBe(IMAGE);
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
    const request = toRoomRequest(draftOf(RECT), { name: "거실", sortOrder: 0 });
    const room: Room = {
      room_id: 7,
      space_id: 1,
      area_m2: 12,
      area_pyeong: 3.6,
      updated_at: "2026-11-19T00:00:00",
      ...request,
    };
    const reopened = roomToDraft(room)!;
    expect(reopened.imageUrl).toBe(IMAGE);
    expect(reopened.roomId).toBe(7);
    expect(reopened.sceneImageUrl).toBe(IMAGE);
    expect(summarizeRoom(reopened)!.areaM2).toBeCloseTo(12, 2);
    expect(isSameRoomDraft(reopened, roomToDraft(room))).toBe(true);
    expect(isSameRoomDraft(reopened, withCeilingHeight(reopened, 2.7))).toBe(false);
  });
});

const SCENE_A = "https://bucket.s3.ap-northeast-2.amazonaws.com/images/a.jpg";
const SCENE_B = "https://bucket.s3.ap-northeast-2.amazonaws.com/images/b.jpg";
const scenes = [{ image_url: SCENE_A, name: "거실" }, { image_url: SCENE_B, name: "" }];

function roomFor(scene: string, roomId: number | null = null): RoomDraft {
  return { ...draftOf(RECT), sceneImageUrl: scene, imageUrl: scene, roomId };
}

function savedRoom(draft: RoomDraft, roomId: number, name: string, sortOrder: number): Room {
  return {
    room_id: roomId,
    space_id: 1,
    area_m2: 12,
    area_pyeong: 3.6,
    updated_at: "2026-11-20T00:00:00",
    ...toRoomRequest(draft, { name, sortOrder }),
  };
}

describe("장면마다 3D 방", () => {
  it("방 이름·순서는 장면에서 정하고, 이름이 없으면 '장면 n'", () => {
    expect(roomPlacement(scenes, SCENE_A)).toEqual({ name: "거실", sortOrder: 0 });
    expect(roomPlacement(scenes, SCENE_B)).toEqual({ name: "장면 2", sortOrder: 1 });
  });

  it("장면마다 방 하나 — 같은 장면에 다시 정하면 바뀌고, 빼면 사라진다", () => {
    let rooms = setRoomForScene([], SCENE_A, roomFor(SCENE_A));
    rooms = setRoomForScene(rooms, SCENE_B, roomFor(SCENE_B));
    rooms = setRoomForScene(rooms, SCENE_A, { ...roomFor(SCENE_A), ceilingHeight: 2.7 });
    expect(rooms).toHaveLength(2);
    expect(rooms.find((room) => room.sceneImageUrl === SCENE_A)!.ceilingHeight).toBe(2.7);
    expect(setRoomForScene(rooms, SCENE_B, null)).toHaveLength(1);
  });

  it("지운 장면의 방은 뺀다", () => {
    const rooms = [roomFor(SCENE_A), roomFor(SCENE_B)];
    expect(keepRoomsForScenes(rooms, [scenes[1]]).map((room) => room.sceneImageUrl)).toEqual([SCENE_B]);
  });
});

describe("수정 화면 저장 계획", () => {
  const a = roomFor(SCENE_A, 1);
  const b = roomFor(SCENE_B, 2);
  const saved = [savedRoom(a, 1, "거실", 0), savedRoom(b, 2, "장면 2", 1)];

  it("바뀐 게 없으면 아무것도 보내지 않는다", () => {
    expect(planRoomSaves([a, b], saved, scenes)).toEqual({ create: [], update: [], remove: [] });
  });

  it("고친 방은 덮어쓰고, 새 방은 만들고, 뺀 방은 지운다", () => {
    const c = "https://bucket.s3.ap-northeast-2.amazonaws.com/images/c.jpg";
    const plan = planRoomSaves(
      [{ ...a, ceilingHeight: 2.7 }, roomFor(c)],
      saved,
      [...scenes, { image_url: c, name: "침실" }],
    );
    expect(plan.update.map((item) => item.roomId)).toEqual([1]);
    expect(plan.create.map((request) => request.name)).toEqual(["침실"]);
    expect(plan.remove).toEqual([2]);
  });

  it("장면 이름·순서만 바뀌어도 덮어쓴다", () => {
    const plan = planRoomSaves([a, b], saved, [{ image_url: SCENE_B, name: "" }, { image_url: SCENE_A, name: "큰 거실" }]);
    expect(plan.update.map((item) => [item.roomId, item.request.name, item.request.sort_order])).toEqual([
      [1, "큰 거실", 1],
      [2, "장면 1", 0],
    ]);
  });
});

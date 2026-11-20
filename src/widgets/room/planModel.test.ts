import { describe, expect, it } from "vitest";
import type { PlanDetection, Room } from "@/entities/room";
import { polygonArea } from "./lib/geometry";
import {
  applyDetectedWalls,
  calibratePlan,
  createPlanDraft,
  nextPlanSortOrder,
  roomToPlanDraft,
  scalePlan,
  summarizePlan,
  toPlanRoomRequest,
  validatePlanDraft,
  type PlanDraft,
} from "./planModel";

const PLAN = "https://bucket.s3.ap-northeast-2.amazonaws.com/images/plan.png";

function drawn(): PlanDraft {
  // 임시 축척(1px = 1cm)으로 400×300px 직사각형을 그린 상태 → 4×3m
  return {
    ...createPlanDraft(PLAN, 1000, 800, "도면 1"),
    outer: [[0, 0], [4, 0], [4, 3], [0, 3]],
    closed: true,
    inner: [[[2, 0], [2, 2]]],
  };
}

describe("도면 방 초안", () => {
  it("도면 이미지를 원점 가운데에 놓고, 임시 축척은 1px = 1cm", () => {
    const draft = createPlanDraft(PLAN, 1000, 800, "도면 1");
    expect(draft.metersPerPixel).toBe(0.01);
    expect(draft.offset).toEqual([-5, -4]);
    expect(draft.calibrated).toBe(false);
  });

  it("축척을 바꾸면 이미지·벽이 함께 커져 도면 위 벽 자리는 그대로", () => {
    const scaled = scalePlan(drawn(), 2);
    expect(scaled.metersPerPixel).toBe(0.02);
    expect(scaled.offset).toEqual([-10, -8]);
    expect(scaled.outer[2]).toEqual([8, 6]);
    expect(scaled.inner[0][1]).toEqual([4, 4]);
    // 이미지 픽셀로 본 벽 끝점 위치는 같다
    const px = (p: [number, number], d: PlanDraft) => [(p[0] - d.offset[0]) / d.metersPerPixel, (p[1] - d.offset[1]) / d.metersPerPixel];
    expect(px([4, 3], drawn())).toEqual(px([8, 6], scaled));
  });

  it("기준 길이로 축척을 맞춘다 — 지금 4m로 그려진 벽이 실제 5.2m면 1.3배", () => {
    const calibrated = calibratePlan(drawn(), 4, 5.2);
    expect(calibrated.calibrated).toBe(true);
    expect(calibrated.metersPerPixel).toBeCloseTo(0.013);
    expect(polygonArea(calibrated.outer)).toBeCloseTo(12 * 1.3 * 1.3);
  });

  it("축척을 안 맞췄거나 바깥벽을 안 닫았으면 저장할 수 없다", () => {
    expect(validatePlanDraft(drawn())).toMatch(/축척/);
    expect(validatePlanDraft({ ...calibratePlan(drawn(), 4, 4), closed: false })).toMatch(/닫아/);
    expect(validatePlanDraft(calibratePlan(drawn(), 4, 4))).toBeNull();
  });

  it("인식 좌표에 축척과 이미지 원점을 적용하고 안쪽 벽의 문 틈을 유지한다", () => {
    const draft = calibratePlan(createPlanDraft(PLAN, 1000, 800, "도면 1"), 5, 2.5);
    const detected = applyDetectedWalls(draft, {
      ok: true,
      width: 1000,
      height: 800,
      outer: [[100, 100], [900, 100], [900, 700], [100, 700]],
      inner: [[[500, 100], [500, 300]], [[500, 500], [500, 700]]],
    });

    expect(detected).toEqual({
      ...draft,
      closed: true,
      outer: [[-2, -1.5], [2, -1.5], [2, 1.5], [-2, 1.5]],
      inner: [[[0, -1.5], [0, -0.5]], [[0, 0.5], [0, 1.5]]],
    });
  });

  it("인식한 이미지 해상도가 절반이면 비율로 맞추고, 가로세로 비율이 다르면 버린다", () => {
    const draft = calibratePlan(createPlanDraft(PLAN, 1000, 800, "도면 1"), 1, 1);
    const half = applyDetectedWalls(draft, {
      ok: true, width: 500, height: 400,
      outer: [[50, 50], [450, 50], [450, 350], [50, 350]], inner: [],
    });
    expect(half?.outer).toEqual([[-4, -3], [4, -3], [4, 3], [-4, 3]]);
    expect(applyDetectedWalls(draft, { ok: true, width: 800, height: 800, outer: [[0, 0], [1, 0], [1, 1]], inner: [] })).toBeNull();
  });

  it("축척 없이 인식해도 임시 축척을 실제 축척으로 확정하지 않는다", () => {
    const draft = createPlanDraft(PLAN, 1000, 800, "도면 1");
    const detection: PlanDetection = { ok: true, width: 1000, height: 800, outer: [[100, 100], [900, 100], [900, 700]], inner: [] };

    expect(applyDetectedWalls(draft, detection)?.calibrated).toBe(false);
    expect(applyDetectedWalls(draft, { ...detection, width: 800 })).toBeNull();
  });

  it("면적·벽 길이는 닫힌 바깥벽으로 계산한다", () => {
    expect(summarizePlan({ ...drawn(), closed: false })).toBeNull();
    expect(summarizePlan(drawn())!.areaM2).toBeCloseTo(12);
  });

  it("저장할 때 원점을 방 가운데로 옮기고 도면 위치도 같이 옮긴다", () => {
    const request = toPlanRoomRequest(calibratePlan(drawn(), 4, 4), 1000);
    expect(request.source).toBe("PLAN");
    expect(request.camera_height).toBeNull();
    expect(request.scene_image_url).toBeNull();
    expect(request.geometry.outer).toEqual([[-2, -1.5], [2, -1.5], [2, 1.5], [-2, 1.5]]);
    expect(request.geometry.inner).toEqual([[[0, -1.5], [0, 0.5]]]);
    expect(request.geometry.plan!.offset).toEqual([-7, -5.5]);
    expect(request.geometry.plan!.width_px).toBe(1000);
  });

  it("저장된 도면 방을 다시 편집 초안으로 연다", () => {
    const request = toPlanRoomRequest(calibratePlan(drawn(), 4, 4), 1000);
    const room: Room = { room_id: 3, space_id: 1, area_m2: 12, area_pyeong: 3.6, updated_at: "", ...request };
    const draft = roomToPlanDraft(room)!;
    expect(draft.roomId).toBe(3);
    expect(draft.calibrated).toBe(true);
    expect(draft.closed).toBe(true);
    expect(polygonArea(draft.outer)).toBeCloseTo(12);
  });

  it("새 도면 방은 장면 방 뒤, 기존 도면 방 다음 순서", () => {
    const base = { space_id: 1, area_m2: 1, area_pyeong: 1, updated_at: "", name: "", scene_image_url: null, image_url: null, ceiling_height: 2.4, camera_height: null, geometry: { outer: [], inner: [], camera: null, yaw: null, corners: null } };
    expect(nextPlanSortOrder([{ ...base, room_id: 1, source: "PANORAMA", sort_order: 0 }])).toBe(1000);
    expect(nextPlanSortOrder([{ ...base, room_id: 2, source: "PLAN", sort_order: 1003 }])).toBe(1004);
  });
});

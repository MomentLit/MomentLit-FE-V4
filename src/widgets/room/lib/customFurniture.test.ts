import { describe, expect, it } from "vitest";
import type { CustomFurniture } from "@/entities/room";
import { customFurnitureDef } from "./customFurniture";
import { findFurniture, furnitureModelKey, knownFurniture, registerCustomFurniture } from "./furniture";

const base: CustomFurniture = {
  id: 7,
  type: "u-7",
  name: "우리 집 의자",
  mount: "FLOOR",
  source: "PHOTO",
  status: "READY",
  width: 0.82,
  depth: 0.61,
  height: 0.9,
  model_url: "/rooms/furniture/7/model",
  thumbnail_url: "/rooms/furniture/7/thumbnail",
  failure_reason: null,
  created_at: "2026-11-22T12:00:00",
};

describe("내 가구", () => {
  it("다 만든 가구만 놓을 수 있는 목록 항목이 된다", () => {
    expect(customFurnitureDef(base)).toMatchObject({ id: "u-7", model: base.model_url, width: 0.82, mount: "floor", custom: true });
    expect(customFurnitureDef({ ...base, status: "PROCESSING", model_url: null })).toBeNull();
    expect(customFurnitureDef({ ...base, status: "FAILED" })).toBeNull();
    expect(customFurnitureDef({ ...base, mount: "WALL" })?.mount).toBe("wall");
  });

  it("등록하면 찾을 수 있고, 다시 등록하면 지운 가구는 빠진다", () => {
    registerCustomFurniture([customFurnitureDef(base)!]);
    expect(findFurniture("u-7")?.name).toBe("우리 집 의자");
    expect(furnitureModelKey(findFurniture("u-7"))).toBe(base.model_url);
    registerCustomFurniture([]);
    expect(findFurniture("u-7")).toBeUndefined();
  });

  it("모델과 썸네일은 해당 가구의 인증 API 경로만 쓴다", () => {
    expect(customFurnitureDef({ ...base, model_url: "https://example.com/model.glb" })).toBeNull();
    expect(customFurnitureDef({ ...base, thumbnail_url: "/rooms/furniture/8/thumbnail" })?.thumbnail).toBeUndefined();
  });

  it("목록을 받기 전에도 저장된 내 가구는 배치에 남긴다", () => {
    expect(knownFurniture([{ type: "u-99" }, { type: "nope" }])).toEqual([{ type: "u-99" }]);
  });
});

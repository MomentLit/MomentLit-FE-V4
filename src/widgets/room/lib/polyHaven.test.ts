import { describe, expect, it } from "vitest";
import { findFurniture, furnitureModelKey, knownFurniture, registerPolyHavenFurniture } from "./furniture";
import { parsePolyHavenAssets, polyHavenFurniture, polyHavenUrlModifier, toFurnitureId } from "./polyHaven";

describe("toFurnitureId", () => {
  it("BE 검증에 맞는 소문자·하이픈 id로 바꾼다", () => {
    expect(toFurnitureId("ArmChair_01")).toBe("ph-armchair-01");
    expect(toFurnitureId("mid_century_lounge_chair")).toBe("ph-mid-century-lounge-chair");
  });
});

describe("parsePolyHavenAssets", () => {
  it("mm 크기를 m로, Blender y(깊이)를 depth로, 많이 받은 순으로", () => {
    const items = parsePolyHavenAssets({
      Rare_01: { name: "Rare", categories: ["props"], dimensions: [500, 500, 500], download_count: 1 },
      ArmChair_01: {
        name: "Arm Chair 01",
        categories: ["furniture", "seating"],
        tags: ["armchair"],
        dimensions: [848.43, 765.76, 1065.09],
        thumbnail_url: "https://cdn.polyhaven.com/asset_img/thumbs/ArmChair_01.png?width=256",
        download_count: 100,
      },
      NoSize: { name: "No size", categories: ["furniture"] },
    });
    expect(items.map((item) => item.id)).toEqual(["ph-armchair-01", "ph-rare-01"]);
    expect(items[0]).toMatchObject({ width: 0.848, depth: 0.766, height: 1.065, polyHavenId: "ArmChair_01", category: "seating" });
    expect(items[1].category).toBe("props");
  });
});

describe("실내 물건 고르기·놓는 방식", () => {
  const asset = (categories: string[], dimensions: number[], tags: string[] = [], name = "x") => ({ name, categories, dimensions, tags });

  it("액자·벽시계는 벽, 샹들리에·천장 선풍기는 천장, 스탠드는 바닥", () => {
    expect(polyHavenFurniture("hanging_picture_frame_01", asset(["wall decoration"], [590, 20, 840]))?.mount).toBe("wall");
    expect(polyHavenFurniture("wall_clock", asset(["appliances", "decorative"], [320, 50, 320], ["wall clock"]))?.mount).toBe("wall");
    expect(polyHavenFurniture("Chandelier_01", asset(["lighting"], [750, 820, 800]))?.mount).toBe("ceiling");
    expect(polyHavenFurniture("ceiling_fan", asset(["appliances", "electronics"], [1460, 1460, 520], ["ceiling"]))?.mount).toBe("ceiling");
    expect(polyHavenFurniture("standing_picture_frame_01", asset(["decorative"], [200, 100, 250], ["picture frame"]))?.mount).toBe("floor");
    expect(polyHavenFurniture("desk_lamp_arm_01", asset(["lighting"], [300, 300, 500], ["desk lamp"]))?.mount).toBe("floor");
  });

  it("종류를 나눈다", () => {
    expect(polyHavenFurniture("a", asset(["lighting"], [300, 300, 500]))?.category).toBe("lighting");
    expect(polyHavenFurniture("b", asset(["electronics"], [600, 200, 400]))?.category).toBe("electronics");
    expect(polyHavenFurniture("c", asset(["vases"], [200, 200, 300]))?.category).toBe("decor");
    expect(polyHavenFurniture("d", asset(["props"], [200, 200, 300]))?.category).toBe("props");
  });

  it("야외·무기·너무 작거나 큰 것은 뺀다 — 가구는 outdoor 태그가 있어도 남긴다", () => {
    expect(polyHavenFurniture("garden_gnome", asset(["decorative"], [200, 200, 400], ["garden"]))).toBeNull();
    expect(polyHavenFurniture("antique_katana_01", asset(["props"], [1000, 50, 100], ["weapon"]))).toBeNull();
    expect(polyHavenFurniture("rock", asset(["nature", "props"], [500, 500, 500]))).toBeNull();
    expect(polyHavenFurniture("pocket_watch", asset(["props"], [50, 20, 60]))).toBeNull();
    expect(polyHavenFurniture("covered_car", asset(["props"], [4500, 1800, 1500]))).toBeNull();
    expect(polyHavenFurniture("painted_wooden_sofa", asset(["furniture", "seating"], [2450, 790, 1280], ["outdoor"]))).not.toBeNull();
  });
});

describe("polyHavenUrlModifier", () => {
  it(".gltf 기준 상대 경로를 include의 실제 주소로 바꾼다", () => {
    const modify = polyHavenUrlModifier({
      url: "https://dl.polyhaven.org/file/ph-assets/Models/gltf/1k/A/A_1k.gltf",
      include: {
        "A.bin": "https://dl.polyhaven.org/file/ph-assets/Models/gltf/4k/A/A.bin",
        "textures/A_diff_1k.jpg": "https://dl.polyhaven.org/file/ph-assets/Models/jpg/1k/A/A_diff_1k.jpg",
      },
    });
    expect(modify("https://dl.polyhaven.org/file/ph-assets/Models/gltf/1k/A/A.bin")).toBe("https://dl.polyhaven.org/file/ph-assets/Models/gltf/4k/A/A.bin");
    expect(modify("https://dl.polyhaven.org/file/ph-assets/Models/gltf/1k/A/textures/A_diff_1k.jpg")).toContain("/jpg/1k/A/");
    expect(modify("blob:http://localhost/x")).toBe("blob:http://localhost/x");
  });
});

describe("가구 등록·찾기", () => {
  it("목록을 받기 전에도 저장된 Poly Haven 가구는 남기고, 받으면 찾을 수 있다", () => {
    expect(knownFurniture([{ type: "ph-not-yet" }, { type: "spaceship" }])).toEqual([{ type: "ph-not-yet" }]);
    expect(findFurniture("ph-not-yet")).toBeUndefined();
    registerPolyHavenFurniture([{ id: "ph-not-yet", name: "의자", width: 0.5, depth: 0.5, height: 0.9, polyHavenId: "NotYet" }]);
    expect(findFurniture("ph-not-yet")?.name).toBe("의자");
  });

  it("모양 출처 — Poly Haven, GLB 주소, 기본 도형", () => {
    registerPolyHavenFurniture([{ id: "ph-only", name: "Chair", width: 1, depth: 1, height: 1, polyHavenId: "Only" }]);
    expect(furnitureModelKey(findFurniture("ph-only"))).toBe("polyhaven:Only");
    expect(furnitureModelKey({ id: "x", name: "x", width: 1, depth: 1, model: "https://cdn/x.glb" })).toBe("https://cdn/x.glb");
    expect(furnitureModelKey(findFurniture("sofa-3"))).toBeNull();
  });
});

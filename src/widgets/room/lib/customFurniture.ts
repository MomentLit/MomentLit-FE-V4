import type { CustomFurniture, CustomFurnitureMount } from "@/entities/room";
import type { FurnitureDef, FurnitureMount } from "./furniture";

const MOUNTS: Record<CustomFurnitureMount, FurnitureMount> = { FLOOR: "floor", WALL: "wall", CEILING: "ceiling" };

export function toFurnitureMount(mount: CustomFurnitureMount): FurnitureMount {
  return MOUNTS[mount];
}

/** 다 만들어진(READY) 내 가구 → 3D 방 가구 목록 항목. 만드는 중·실패한 것은 놓을 수 없어 null. */
export function customFurnitureDef(furniture: CustomFurniture): FurnitureDef | null {
  const assetPath = `/rooms/furniture/${furniture.id}`;
  if (furniture.status !== "READY" || furniture.model_url !== `${assetPath}/model`) return null;
  return {
    id: furniture.type,
    name: furniture.name,
    width: furniture.width ?? 0.5,
    depth: furniture.depth ?? 0.5,
    height: furniture.height,
    model: furniture.model_url,
    thumbnail: furniture.thumbnail_url === `${assetPath}/thumbnail` ? furniture.thumbnail_url : undefined,
    mount: toFurnitureMount(furniture.mount),
    custom: true,
  };
}

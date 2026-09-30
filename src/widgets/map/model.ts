import type { SpaceListItem } from "@/entities/space";

export interface SpacePin {
  space: SpaceListItem;
  longitude: number;
  latitude: number;
}

export async function locateSpace(space: SpaceListItem, signal: AbortSignal): Promise<SpacePin | null> {
  const address = space.address.road_address || space.address.jibun_address;
  if (!address) return null;
  const response = await fetch(`/api/map/geocode?${new URLSearchParams({ address })}`, { signal });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("공간 위치를 불러오지 못했어요. 다시 시도해 주세요.");
  const point = await response.json() as { longitude: number; latitude: number };
  return { space, ...point };
}

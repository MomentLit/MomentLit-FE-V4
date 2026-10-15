import type { SpaceListItem } from "@/entities/space";
import { geocodeAddress } from "./lib/geocode";

export interface SpacePin {
  space: SpaceListItem;
  longitude: number;
  latitude: number;
}

export async function locateSpace(space: SpaceListItem, signal: AbortSignal): Promise<SpacePin | null> {
  const address = space.address.road_address || space.address.jibun_address;
  if (!address) return null;
  const coords = await geocodeAddress(address, signal);
  return coords ? { space, ...coords } : null;
}

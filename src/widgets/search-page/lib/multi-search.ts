import { searchSpaces, type SpaceSearchParams } from "@/entities/space/api";
import type { Region } from "@/entities/region";
import type { SpaceCategory } from "@/entities/space-category";
import { groupSpaceOptions, type GroupedSpace, type SpaceListItem } from "@/entities/space";
import { collectPages } from "@/shared/api/pagination";

export { collectPages } from "@/shared/api/pagination";

/** Backend accepts one value per field. Narrow single values server-side,
 * then apply OR within each multi-selection and AND between fields.
 * Group before UI pagination so counts and section groups span every server page.
 * Keeping the server sequence preserves latest/popular/distance sorting. */
export async function searchSelectedSpaces(
  params: Omit<SpaceSearchParams, "page" | "size">,
  regions: Region[],
  categories: SpaceCategory[],
  signal?: AbortSignal,
): Promise<GroupedSpace<SpaceListItem>[]> {
  const narrowed = {
    ...params,
    region: regions.length === 1 ? regions[0] : undefined,
    category: categories.length === 1 ? categories[0] : undefined,
  };
  const all = await collectPages((page) => searchSpaces({ ...narrowed, page, size: 100 }, signal));
  const matched = all.filter((space) =>
    (regions.length === 0 || (space.address.region !== null && regions.includes(space.address.region))) &&
    (categories.length === 0 || categories.includes(space.category)),
  );
  return groupSpaceOptions(matched);
}

export function toggleSelection<T>(selected: T[], value: T): T[] {
  return selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value];
}

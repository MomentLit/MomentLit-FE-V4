import { searchSpaces, type SpaceSearchParams } from "@/entities/space/api";
import type { Region } from "@/entities/region";
import type { SpaceCategory } from "@/entities/space-category";
import type { SpaceListItem } from "@/entities/space";
import type { PageResponse } from "@/shared/api/types";

/** Fetch all pages in server order; do not silently truncate multi-select results. */
export async function collectPages<T>(
  fetchPage: (page: number) => Promise<PageResponse<T>>,
): Promise<T[]> {
  const first = await fetchPage(0);
  const items = [...first.content];
  for (let start = 1; start < first.totalPages; start += 4) {
    const pages = await Promise.all(
      Array.from({ length: Math.min(4, first.totalPages - start) }, (_, offset) => fetchPage(start + offset)),
    );
    for (const page of pages) items.push(...page.content);
  }
  return items;
}

/** Backend accepts one value per field. Narrow single values server-side,
 * then apply OR within each multi-selection and AND between fields.
 * Keeping the server sequence preserves latest/popular/distance sorting. */
export async function searchSelectedSpaces(
  params: SpaceSearchParams,
  regions: Region[],
  categories: SpaceCategory[],
  signal?: AbortSignal,
): Promise<PageResponse<SpaceListItem>> {
  const narrowed = {
    ...params,
    region: regions.length === 1 ? regions[0] : undefined,
    category: categories.length === 1 ? categories[0] : undefined,
  };
  if (regions.length <= 1 && categories.length <= 1) return searchSpaces(narrowed, signal);
  const all = await collectPages((page) => searchSpaces({ ...narrowed, page, size: 100 }, signal));
  const matched = all.filter((space) =>
    (regions.length === 0 || (space.address.region !== null && regions.includes(space.address.region))) &&
    (categories.length === 0 || categories.includes(space.category)),
  );
  const page = params.page ?? 0;
  const size = params.size ?? 12;
  return {
    content: matched.slice(page * size, (page + 1) * size),
    page, size, totalElements: matched.length, totalPages: Math.ceil(matched.length / size),
  };
}

export function toggleSelection<T>(selected: T[], value: T): T[] {
  return selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value];
}

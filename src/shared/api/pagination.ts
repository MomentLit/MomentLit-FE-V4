import type { PageResponse } from "./types";

/** Collect every page in server order, preserving failures instead of returning partial counts. */
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

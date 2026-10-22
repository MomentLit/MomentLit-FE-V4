import { useQuery } from "@tanstack/react-query";
import { fetchSpaceDisplayCounts } from "./api";

/** Home and search share one complete snapshot for their displayed counts. */
export function useSpaceDisplayCounts() {
  return useQuery({
    queryKey: ["spaces", "counts", "grouped"],
    queryFn: ({ signal }) => fetchSpaceDisplayCounts(signal),
    staleTime: 30_000,
  });
}

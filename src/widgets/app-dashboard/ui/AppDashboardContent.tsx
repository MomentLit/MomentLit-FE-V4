import { ComboSearch } from "./ComboSearch";
import { CategoryFilterPills } from "./CategoryFilterPills";
import { RecentPopupCards } from "./RecentPopupCards";
import { RecentSpaceCards } from "./RecentSpaceCards";
import { RegionCounts } from "./RegionCounts";
import { MyReservationsTable } from "./MyReservationsTable";

/**
 * Main work area of the logged-in app dashboard (everything right of the
 * sidebar) — combo search, category filter pills, recent popup/space cards,
 * region counts, and the my-reservations table. See ANALYSIS.md §2.2.
 */
export function AppDashboardContent() {
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <ComboSearch />
      <CategoryFilterPills />
      <RecentPopupCards />
      <RecentSpaceCards />
      <RegionCounts />
      <MyReservationsTable />
    </div>
  );
}

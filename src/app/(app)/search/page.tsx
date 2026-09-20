import { Suspense } from "react";
import { SearchPageContent } from "@/widgets/search-page";

/** 검색 결과 — see ANALYSIS.md §2.3. */
export default function SearchPage() {
  return (
    <Suspense fallback={<div className="flex-1 p-10 text-sm text-soft">불러오는 중…</div>}>
      <SearchPageContent />
    </Suspense>
  );
}
